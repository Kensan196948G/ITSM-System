#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import socket
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"
ROLES_FILE = DATA_DIR / "roles.json"
AUDIT_FILE = DATA_DIR / "audit.json"


DEFAULT_USERS = [
    {
        "id": "USR-001",
        "userId": "t.yamada",
        "name": "山田 太郎",
        "department": "情報システム部",
        "role": "運用管理者",
        "status": "active",
        "email": "t.yamada@example.local",
    },
    {
        "id": "USR-002",
        "userId": "h.sato",
        "name": "佐藤 花子",
        "department": "サービスデスク",
        "role": "サービスデスク",
        "status": "active",
        "email": "h.sato@example.local",
    },
    {
        "id": "USR-003",
        "userId": "sec.ops",
        "name": "SecOps Bot",
        "department": "セキュリティ運用",
        "role": "SecOps",
        "status": "inactive",
        "email": "secops-bot@example.local",
    },
]

DEFAULT_ROLES = [
    {"role": "運用管理者", "scope": "全画面", "update": "可", "approve": "可", "audit": "可", "admin": "可"},
    {"role": "サービスデスク", "scope": "運用系", "update": "可", "approve": "不可", "audit": "不可", "admin": "不可"},
    {"role": "SecOps", "scope": "セキュリティ系", "update": "可", "approve": "不可", "audit": "可", "admin": "不可"},
    {"role": "監査者", "scope": "全画面", "update": "不可", "approve": "不可", "audit": "可", "admin": "不可"},
]

DEFAULT_AUDIT = [
    {"time": "14:45", "actor": "佐藤 花子", "action": "CHG-208 ステータス更新", "detail": "実施中へ変更 / 影響監視開始"},
    {"time": "14:38", "actor": "System", "action": "SLAアラート", "detail": "REQ-330 期限2時間前を通知"},
]


def default_users_data() -> list[dict]:
    return [{**u, "version": int(u.get("version", 1) or 1)} for u in DEFAULT_USERS]


def default_roles_data() -> list[dict]:
    return [dict(r) for r in DEFAULT_ROLES]


def default_audit_data() -> list[dict]:
    return [dict(a) for a in DEFAULT_AUDIT]


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not USERS_FILE.exists():
        USERS_FILE.write_text(json.dumps(default_users_data(), ensure_ascii=False, indent=2), encoding="utf-8")
    if not ROLES_FILE.exists():
        ROLES_FILE.write_text(json.dumps(default_roles_data(), ensure_ascii=False, indent=2), encoding="utf-8")
    if not AUDIT_FILE.exists():
        AUDIT_FILE.write_text(json.dumps(default_audit_data(), ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def next_user_id(users: list[dict]) -> str:
    nums = []
    for user in users:
        try:
            nums.append(int(str(user.get("id", "")).replace("USR-", "")))
        except ValueError:
            pass
    return f"USR-{max(nums, default=0)+1:03d}"


def load_users() -> list[dict]:
    users = load_json(USERS_FILE)
    changed = False
    normalized = []
    for user in users:
        row = dict(user)
        version = row.get("version", 1)
        try:
            version = int(version)
        except (TypeError, ValueError):
            version = 1
        if version < 1:
            version = 1
        if row.get("version") != version:
            changed = True
        row["version"] = version
        normalized.append(row)
    if changed:
        save_json(USERS_FILE, normalized)
    return normalized


USER_ID_RE = re.compile(r"^[A-Za-z0-9._-]{3,32}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_user(payload: dict, *, roles: list[dict], users: list[dict] | None = None, editing_id: str | None = None) -> tuple[bool, str, dict]:
    fields: dict[str, str] = {}
    user_id = str(payload.get("userId", "")).strip()
    name = str(payload.get("name", "")).strip()
    department = str(payload.get("department", "")).strip()
    role = str(payload.get("role", "")).strip()
    status = str(payload.get("status", "")).strip()
    email = str(payload.get("email", "")).strip()

    if not user_id:
        fields["userId"] = "必須項目です。"
    elif not USER_ID_RE.fullmatch(user_id):
        fields["userId"] = "3-32文字の英数字・`.`・`_`・`-`のみ使用できます。"

    if not name:
        fields["name"] = "必須項目です。"
    elif not (2 <= len(name) <= 40):
        fields["name"] = "2〜40文字で入力してください。"

    if not department:
        fields["department"] = "必須項目です。"
    elif not (2 <= len(department) <= 60):
        fields["department"] = "2〜60文字で入力してください。"

    if not email:
        fields["email"] = "必須項目です。"
    elif len(email) > 120 or not EMAIL_RE.fullmatch(email):
        fields["email"] = "有効なメールアドレスを入力してください。"

    role_names = {str(r.get("role", "")).strip() for r in roles}
    if role not in role_names:
        fields["role"] = "選択されたロール権限が不正です。"

    if status not in {"active", "inactive"}:
        fields["status"] = "状態が不正です。"

    if users is not None and user_id:
        duplicate = next((u for u in users if u.get("userId") == user_id and u.get("id") != editing_id), None)
        if duplicate:
            fields["userId"] = "既に存在するユーザーIDです。"

    if fields:
        first_message = next(iter(fields.values()))
        return False, first_message, fields
    return True, "", {}


def validate_roles(payload: object) -> tuple[bool, str, dict]:
    if not isinstance(payload, list):
        return False, "roles payload must be array", {}
    fields: dict[str, str] = {}
    allowed_scope = {"全画面", "運用系", "セキュリティ系", "一部画面", "参照のみ"}
    allowed_perm = {"可", "不可"}
    seen = set()
    for idx, row in enumerate(payload):
        if not isinstance(row, dict):
            fields[f"row_{idx}"] = "row must be object"
            continue
        role = str(row.get("role", "")).strip()
        if not role:
            fields[f"row_{idx}.role"] = "role is required"
        elif role in seen:
            fields[f"row_{idx}.role"] = "duplicate role"
        seen.add(role)
        scope = str(row.get("scope", "")).strip()
        if scope not in allowed_scope:
            fields[f"row_{idx}.scope"] = "invalid scope"
        for key in ("update", "approve", "audit", "admin"):
            if str(row.get(key, "")) not in allowed_perm:
                fields[f"row_{idx}.{key}"] = "must be 可 or 不可"
    if fields:
        return False, next(iter(fields.values())), fields
    return True, "", {}


def append_audit(entry: dict) -> None:
    audit = load_json(AUDIT_FILE)
    audit.insert(0, entry)
    save_json(AUDIT_FILE, audit[:200])


def audit_entry(actor: str, action: str, detail: str, before=None, after=None) -> dict:
    entry = {
        "time": datetime.now().strftime("%H:%M"),
        "actor": actor,
        "action": action,
        "detail": detail,
    }
    if before is not None:
        entry["before"] = before
    if after is not None:
        entry["after"] = after
    return entry


def dict_diff(before: dict, after: dict, keys: list[str]) -> dict:
    diff = {}
    for key in keys:
        bv = before.get(key)
        av = after.get(key)
        if bv != av:
            diff[key] = {"before": bv, "after": av}
    return diff


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/users":
            return self._json_response(load_users())
        if parsed.path == "/api/roles":
            return self._json_response(load_json(ROLES_FILE))
        if parsed.path == "/api/audit":
            audit = load_json(AUDIT_FILE)
            params = parse_qs(parsed.query)
            q = str(params.get("q", [""])[0]).strip().lower()
            action = str(params.get("action", [""])[0]).strip()
            actor = str(params.get("actor", [""])[0]).strip()
            sort = str(params.get("sort", ["time"])[0]).strip()
            order = str(params.get("order", ["desc"])[0]).strip().lower()
            try:
                limit = int(params.get("limit", ["20"])[0])
            except ValueError:
                limit = 20
            try:
                offset = int(params.get("offset", ["0"])[0])
            except ValueError:
                offset = 0

            if q:
                audit = [x for x in audit if q in json.dumps(x, ensure_ascii=False).lower()]
            if action:
                audit = [x for x in audit if str(x.get("action", "")) == action]
            if actor:
                audit = [x for x in audit if str(x.get("actor", "")) == actor]

            reverse = order != "asc"
            if sort in {"time", "actor", "action", "detail"}:
                def _key(row):
                    if sort == "time":
                        return str(row.get("time", "")).replace(":", "")
                    return str(row.get(sort, ""))
                audit = sorted(audit, key=_key, reverse=reverse)

            offset = max(0, offset)
            limit = max(0, limit)
            sliced = audit[offset: offset + limit if limit else None]
            return self._json_response({
                "items": sliced,
                "total": len(audit),
                "offset": offset,
                "limit": limit,
                "sort": sort,
                "order": order,
                "filters": {"q": q, "action": action, "actor": actor},
            })
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/test/reset":
            users = default_users_data()
            roles = default_roles_data()
            audit = default_audit_data()
            save_json(USERS_FILE, users)
            save_json(ROLES_FILE, roles)
            save_json(AUDIT_FILE, audit)
            return self._json_response({"ok": True, "users": len(users), "roles": len(roles), "audit": len(audit)})

        if parsed.path == "/api/users":
            payload = self._read_json_body()
            if payload is None:
                return
            users = load_users()
            roles = load_json(ROLES_FILE)
            ok, message, fields = validate_user(payload, roles=roles, users=users)
            if not ok:
                status = HTTPStatus.CONFLICT if fields.get("userId") == "既に存在するユーザーIDです。" else HTTPStatus.BAD_REQUEST
                return self._json_error(status, message, fields=fields)
            user = {"id": next_user_id(users), "version": 1, **payload}
            users.insert(0, user)
            save_json(USERS_FILE, users)
            append_audit(audit_entry("API", "ユーザー作成", f"{user['id']} / {user['userId']}", before=None, after=user))
            return self._json_response(user, status=HTTPStatus.CREATED)

        if parsed.path == "/api/audit":
            payload = self._read_json_body()
            if payload is None:
                return
            entry = {
                "time": payload.get("time") or datetime.now().strftime("%H:%M"),
                "actor": payload.get("actor", "System"),
                "action": payload.get("action", "イベント"),
                "detail": payload.get("detail", ""),
            }
            if "before" in payload:
                entry["before"] = payload["before"]
            if "after" in payload:
                entry["after"] = payload["after"]
            append_audit(entry)
            return self._json_response(entry, status=HTTPStatus.CREATED)

        return self._json_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/roles":
            payload = self._read_json_body()
            if payload is None:
                return
            ok, message, fields = validate_roles(payload)
            if not ok:
                return self._json_error(HTTPStatus.BAD_REQUEST, message, fields=fields)
            before = load_json(ROLES_FILE)
            save_json(ROLES_FILE, payload)
            diff = {
                row.get("role", f"row_{i}"): dict_diff(
                    next((b for b in before if b.get("role") == row.get("role")), {}),
                    row,
                    ["scope", "update", "approve", "audit", "admin"],
                )
                for i, row in enumerate(payload)
            }
            diff = {k: v for k, v in diff.items() if v}
            append_audit(audit_entry("API", "ロール権限更新", "roles matrix updated", before=before, after=payload if diff else before))
            return self._json_response(payload)

        if parsed.path.startswith("/api/users/"):
            user_id = parsed.path.split("/", 3)[-1]
            payload = self._read_json_body()
            if payload is None:
                return
            users = load_users()
            roles = load_json(ROLES_FILE)
            ok, message, fields = validate_user(payload, roles=roles, users=users, editing_id=user_id)
            if not ok:
                status = HTTPStatus.CONFLICT if fields.get("userId") == "既に存在するユーザーIDです。" else HTTPStatus.BAD_REQUEST
                return self._json_error(status, message, fields=fields)
            for idx, user in enumerate(users):
                if user["id"] == user_id:
                    before = dict(user)
                    expected_version = self.headers.get("If-Match-Version")
                    if expected_version is not None:
                        try:
                            expected_version_num = int(expected_version)
                        except ValueError:
                            return self._json_error(HTTPStatus.BAD_REQUEST, "invalid If-Match-Version", fields={"version": "invalid version header"})
                        if expected_version_num != int(user.get("version", 1)):
                            return self._json_error(
                                HTTPStatus.CONFLICT,
                                "version conflict",
                                fields={"name": "他の更新が先に保存されました。"},
                            )
                    next_version = int(user.get("version", 1)) + 1
                    users[idx] = {"id": user_id, "version": next_version, **payload}
                    save_json(USERS_FILE, users)
                    append_audit(
                        audit_entry(
                            "API",
                            "ユーザー更新",
                            f"{user_id} / {payload.get('userId', '')}",
                            before=before,
                            after=users[idx],
                        )
                    )
                    return self._json_response(users[idx])
            return self._json_error(HTTPStatus.NOT_FOUND, "user not found")

        return self._json_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/users/"):
            user_id = parsed.path.split("/", 3)[-1]
            users = load_users()
            before_user = next((u for u in users if u["id"] == user_id), None)
            next_users = [u for u in users if u["id"] != user_id]
            if len(next_users) == len(users):
                return self._json_error(HTTPStatus.NOT_FOUND, "user not found")
            save_json(USERS_FILE, next_users)
            append_audit(audit_entry("API", "ユーザー削除", f"{user_id} deleted", before=before_user, after=None))
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        return self._json_error(HTTPStatus.NOT_FOUND, "Not found")

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        body = self.rfile.read(length) if length else b""
        try:
            return json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json_error(HTTPStatus.BAD_REQUEST, "invalid json")
            return None

    def _json_response(self, data, status=HTTPStatus.OK):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _json_error(self, status: HTTPStatus, message: str, *, fields: dict | None = None):
        payload = {"error": message}
        if fields:
            payload["fields"] = fields
        self._json_response(payload, status=status)


def detect_primary_ipv4() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main() -> None:
    ensure_data_files()
    host = "0.0.0.0"
    port = 8765
    server = ThreadingHTTPServer((host, port), Handler)
    ip = detect_primary_ipv4()
    print(f"Serving WebUI + API at http://{ip}:{port} (bind: {host})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
