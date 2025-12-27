/**
 * データテーブルユーティリティ関数
 * ページネーション、ソート、フィルタ、エクスポート機能
 */

// ページネーション
class Paginator {
  constructor(data, itemsPerPage = 10) {
    this.data = data;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
  }

  get totalPages() {
    return Math.ceil(this.data.length / this.itemsPerPage);
  }

  get currentData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.data.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
}

// ソート機能
function sortData(data, key, direction = 'asc') {
  return [...data].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];

    // 数値の場合
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // 文字列の場合
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (direction === 'asc') {
      return aVal.localeCompare(bVal);
    }
    return bVal.localeCompare(aVal);
  });
}

// フィルタ機能
function filterData(data, filters) {
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true;

      const itemValue = String(item[key]).toLowerCase();
      const filterValue = String(value).toLowerCase();

      return itemValue.includes(filterValue);
    });
  });
}

// 検索機能
function searchData(data, searchTerm, searchFields) {
  if (!searchTerm) return data;

  const term = searchTerm.toLowerCase();

  return data.filter(item => {
    return searchFields.some(field => {
      const value = String(item[field] || '').toLowerCase();
      return value.includes(term);
    });
  });
}

// CSVエクスポート
function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    alert('エクスポートするデータがありません');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] || '';
        // CSV形式でエスケープ
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Excelエクスポート（XLSXライブラリ使用）
function exportToExcel(data, filename = 'export.xlsx') {
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded');
    alert('Excelエクスポート機能が利用できません');
    return;
  }

  if (!data || data.length === 0) {
    alert('エクスポートするデータがありません');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  XLSX.writeFile(workbook, filename);
}

// ページネーションUIコンポーネント生成
function createPaginationUI(paginator, onPageChange) {
  const paginationDiv = document.createElement('div');
  paginationDiv.className = 'pagination';

  // 前へボタン
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '前へ';
  prevBtn.className = 'pagination-btn';
  prevBtn.disabled = paginator.currentPage === 1;
  prevBtn.addEventListener('click', () => {
    paginator.prevPage();
    onPageChange();
  });

  // ページ番号表示
  const pageInfo = document.createElement('span');
  pageInfo.className = 'pagination-info';
  pageInfo.textContent = `Page ${paginator.currentPage} / ${paginator.totalPages}`;

  // 次へボタン
  const nextBtn = document.createElement('button');
  nextBtn.textContent = '次へ';
  nextBtn.className = 'pagination-btn';
  nextBtn.disabled = paginator.currentPage === paginator.totalPages;
  nextBtn.addEventListener('click', () => {
    paginator.nextPage();
    onPageChange();
  });

  paginationDiv.appendChild(prevBtn);
  paginationDiv.appendChild(pageInfo);
  paginationDiv.appendChild(nextBtn);

  return paginationDiv;
}

// Node.js環境用のエクスポート（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Paginator,
    sortData,
    filterData,
    searchData,
    exportToCSV,
    exportToExcel,
    createPaginationUI
  };
}
