import * as fabric from 'fabric';

/**
 * Filter Manager - 图片滤镜管理
 */
export class FilterManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;
    this.filters = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      noise: 0
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // 滤镜控制
    const filterControls = [
      { id: 'filter-brightness', property: 'brightness', min: -1, max: 1 },
      { id: 'filter-contrast', property: 'contrast', min: -1, max: 1 },
      { id: 'filter-saturation', property: 'saturation', min: -1, max: 1 },
      { id: 'filter-blur', property: 'blur', min: 0, max: 1 },
      { id: 'filter-noise', property: 'noise', min: 0, max: 1000 }
    ];

    filterControls.forEach(control => {
      const input = document.getElementById(control.id);
      if (input) {
        input.addEventListener('input', (e) => {
          this.filters[control.property] = parseFloat(e.target.value);
          this.updateFilterValue(control.id, e.target.value);
          this.applyFilters();
        });
      }
    });

    // 重置滤镜按钮
    document.getElementById('reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });
  }

  updateFilterValue(inputId, value) {
    const input = document.getElementById(inputId);
    if (input) {
      const valueSpan = input.parentElement.querySelector('.filter-value');
      if (valueSpan) {
        if (inputId === 'filter-noise') {
          valueSpan.textContent = Math.round(value);
        } else {
          valueSpan.textContent = parseFloat(value).toFixed(2);
        }
      }
    }
  }

  applyFilters() {
    const obj = this.canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;

    // 清除现有滤镜
    obj.filters = [];

    // 应用亮度
    if (this.filters.brightness !== 0) {
      obj.filters.push(new fabric.filters.Brightness({
        brightness: this.filters.brightness
      }));
    }

    // 应用对比度
    if (this.filters.contrast !== 0) {
      obj.filters.push(new fabric.filters.Contrast({
        contrast: this.filters.contrast
      }));
    }

    // 应用饱和度
    if (this.filters.saturation !== 0) {
      obj.filters.push(new fabric.filters.Saturation({
        saturation: this.filters.saturation
      }));
    }

    // 应用模糊
    if (this.filters.blur > 0) {
      obj.filters.push(new fabric.filters.Blur({
        blur: this.filters.blur
      }));
    }

    // 应用噪点
    if (this.filters.noise > 0) {
      obj.filters.push(new fabric.filters.Noise({
        noise: this.filters.noise
      }));
    }

    obj.applyFilters();
    this.canvas.renderAll();
  }

  updateFilterUI(obj) {
    // 从对象的滤镜中读取当前值
    this.filters = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      noise: 0
    };

    if (obj.filters) {
      obj.filters.forEach(filter => {
        if (filter.type === 'Brightness') {
          this.filters.brightness = filter.brightness || 0;
        } else if (filter.type === 'Contrast') {
          this.filters.contrast = filter.contrast || 0;
        } else if (filter.type === 'Saturation') {
          this.filters.saturation = filter.saturation || 0;
        } else if (filter.type === 'Blur') {
          this.filters.blur = filter.blur || 0;
        } else if (filter.type === 'Noise') {
          this.filters.noise = filter.noise || 0;
        }
      });
    }

    // 更新UI
    const brightnessInput = document.getElementById('filter-brightness');
    if (brightnessInput) {
      brightnessInput.value = this.filters.brightness;
      this.updateFilterValue('filter-brightness', this.filters.brightness);
    }

    const contrastInput = document.getElementById('filter-contrast');
    if (contrastInput) {
      contrastInput.value = this.filters.contrast;
      this.updateFilterValue('filter-contrast', this.filters.contrast);
    }

    const saturationInput = document.getElementById('filter-saturation');
    if (saturationInput) {
      saturationInput.value = this.filters.saturation;
      this.updateFilterValue('filter-saturation', this.filters.saturation);
    }

    const blurInput = document.getElementById('filter-blur');
    if (blurInput) {
      blurInput.value = this.filters.blur;
      this.updateFilterValue('filter-blur', this.filters.blur);
    }

    const noiseInput = document.getElementById('filter-noise');
    if (noiseInput) {
      noiseInput.value = this.filters.noise;
      this.updateFilterValue('filter-noise', this.filters.noise);
    }
  }

  resetFilters() {
    this.filters = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      noise: 0
    };

    // 重置UI
    ['filter-brightness', 'filter-contrast', 'filter-saturation', 'filter-blur', 'filter-noise'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.value = id === 'filter-noise' ? 0 : 0;
        this.updateFilterValue(id, 0);
      }
    });

    // 应用（清除）滤镜
    const obj = this.canvas.getActiveObject();
    if (obj && obj.type === 'image') {
      obj.filters = [];
      obj.applyFilters();
      this.canvas.renderAll();
      this.editor.history.saveState();
    }
  }
}
