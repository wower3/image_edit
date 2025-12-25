import * as fabric from 'fabric';

/**
 * IO Manager - 导入导出管理
 */
export class IOManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // 图片导入
    document.getElementById('image-input')?.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    // JSON 导入
    document.getElementById('json-input')?.addEventListener('change', (e) => {
      this.handleJSONImport(e);
    });

    document.getElementById('import-json-btn')?.addEventListener('click', () => {
      document.getElementById('json-input')?.click();
    });

    // 保存项目
    document.getElementById('save-json-btn')?.addEventListener('click', () => {
      this.saveAsJSON();
    });

    // 导出按钮
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.showExportModal();
    });

    // 导出对话框
    document.getElementById('close-export-modal')?.addEventListener('click', () => {
      this.hideExportModal();
    });

    document.getElementById('cancel-export')?.addEventListener('click', () => {
      this.hideExportModal();
    });

    document.getElementById('confirm-export')?.addEventListener('click', () => {
      this.exportImage();
    });

    // 导出格式切换
    document.getElementById('export-format')?.addEventListener('change', (e) => {
      const qualitySection = document.getElementById('export-quality-section');
      if (qualitySection) {
        qualitySection.classList.toggle('hidden', e.target.value !== 'jpeg');
      }
    });

    // 导出质量显示
    document.getElementById('export-quality')?.addEventListener('input', (e) => {
      const valueSpan = document.getElementById('export-quality-value');
      if (valueSpan) {
        valueSpan.textContent = `${Math.round(e.target.value * 100)}%`;
      }
    });

    // 拖拽上传
    this.setupDragAndDrop();

    // 粘贴上传
    this.setupPasteUpload();
  }

  setupDragAndDrop() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!canvasWrapper) return;

    canvasWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasWrapper.style.background = 'rgba(79, 70, 229, 0.1)';
    });

    canvasWrapper.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasWrapper.style.background = '';
    });

    canvasWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasWrapper.style.background = '';

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.loadImageFile(files[0]);
      }
    });
  }

  setupPasteUpload() {
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            this.loadImageFile(file);
          }
          break;
        }
      }
    });
  }

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
      this.loadImageFile(file);
    }
    e.target.value = '';
  }

  loadImageFile(file) {
    if (!file.type.startsWith('image/')) {
      this.editor.showToast('请选择图片文件', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      fabric.FabricImage.fromURL(event.target.result, { crossOrigin: 'anonymous' }).then((img) => {
        // 缩放图片以适应画布
        const maxWidth = this.canvas.getWidth() * 0.8;
        const maxHeight = this.canvas.getHeight() * 0.8;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

        img.set({
          left: (this.canvas.getWidth() - img.width * scale) / 2,
          top: (this.canvas.getHeight() - img.height * scale) / 2,
          scaleX: scale,
          scaleY: scale
        });

        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.renderAll();
        this.editor.history.saveState();
        this.editor.showToast('图片已添加', 'success');
      });
    };
    reader.readAsDataURL(file);
  }

  handleJSONImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        // Fabric.js v6 使用 Promise API
        this.canvas.loadFromJSON(json).then(() => {
          this.canvas.renderAll();
          // 确保所有对象可选择和可交互
          this.canvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
          });
          this.editor.history.clear();
          this.editor.showToast('项目已加载', 'success');
        }).catch(err => {
          this.editor.showToast('加载项目失败', 'error');
          console.error('JSON load error:', err);
        });
      } catch (err) {
        this.editor.showToast('无效的项目文件', 'error');
        console.error('JSON import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  saveAsJSON() {
    const json = this.canvas.toJSON([
      'id', 'selectable', 'evented', 'name',
      'filters', 'crossOrigin'
    ]);

    const dataStr = JSON.stringify(json, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `fabric-project-${Date.now()}.json`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
    this.editor.showToast('项目已保存', 'success');
  }

  showExportModal() {
    document.getElementById('export-modal')?.classList.remove('hidden');
  }

  hideExportModal() {
    document.getElementById('export-modal')?.classList.add('hidden');
  }

  exportImage() {
    const format = document.getElementById('export-format')?.value || 'png';
    const quality = parseFloat(document.getElementById('export-quality')?.value || 0.9);
    const multiplier = parseInt(document.getElementById('export-multiplier')?.value || 1);

    // 临时隐藏选择框
    const activeObject = this.canvas.getActiveObject();
    this.canvas.discardActiveObject();
    this.canvas.renderAll();

    if (format === 'svg') {
      this.exportAsSVG();
    } else {
      this.exportAsRaster(format, quality, multiplier);
    }

    // 恢复选择
    if (activeObject) {
      this.canvas.setActiveObject(activeObject);
      this.canvas.renderAll();
    }

    this.hideExportModal();
  }

  exportAsRaster(format, quality, multiplier) {
    const dataURL = this.canvas.toDataURL({
      format: format,
      quality: quality,
      multiplier: multiplier
    });

    const link = document.createElement('a');
    link.download = `fabric-export-${Date.now()}.${format}`;
    link.href = dataURL;
    link.click();

    this.editor.showToast(`已导出为 ${format.toUpperCase()}`, 'success');
  }

  exportAsSVG() {
    const svg = this.canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `fabric-export-${Date.now()}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
    this.editor.showToast('已导出为 SVG', 'success');
  }
}
