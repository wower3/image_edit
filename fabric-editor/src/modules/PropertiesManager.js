import * as fabric from 'fabric';

/**
 * Properties Panel Manager - 属性面板管理
 */
export class PropertiesManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;
    this.selectedObject = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // 画布选择事件
    this.canvas.on('selection:created', (e) => this.onSelectionChange(e));
    this.canvas.on('selection:updated', (e) => this.onSelectionChange(e));
    this.canvas.on('selection:cleared', () => this.onSelectionClear());
    this.canvas.on('object:modified', () => this.updatePropertyValues());
    this.canvas.on('object:scaling', () => this.updatePropertyValues());
    this.canvas.on('object:moving', () => this.updatePropertyValues());
    this.canvas.on('object:rotating', () => this.updatePropertyValues());

    // 属性输入事件
    this.setupPropertyInputs();
    this.setupLayerButtons();
    this.setupAlignButtons();
    this.setupGroupButtons();
    this.setupTextProperties();
  }

  setupPropertyInputs() {
    // 位置和尺寸
    ['prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-angle'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.applyPropertyChange(id, input.value));
      }
    });

    // 填充颜色
    const fillColor = document.getElementById('prop-fill');
    const fillText = document.getElementById('prop-fill-text');
    if (fillColor) {
      fillColor.addEventListener('input', (e) => {
        this.applyPropertyChange('fill', e.target.value);
        if (fillText) fillText.value = e.target.value;
      });
    }
    if (fillText) {
      fillText.addEventListener('change', (e) => {
        this.applyPropertyChange('fill', e.target.value);
        if (fillColor) fillColor.value = e.target.value;
      });
    }

    // 描边颜色
    const strokeColor = document.getElementById('prop-stroke');
    const strokeText = document.getElementById('prop-stroke-text');
    if (strokeColor) {
      strokeColor.addEventListener('input', (e) => {
        this.applyPropertyChange('stroke', e.target.value);
        if (strokeText) strokeText.value = e.target.value;
      });
    }
    if (strokeText) {
      strokeText.addEventListener('change', (e) => {
        this.applyPropertyChange('stroke', e.target.value);
        if (strokeColor) strokeColor.value = e.target.value;
      });
    }

    // 描边粗细
    const strokeWidth = document.getElementById('prop-stroke-width');
    if (strokeWidth) {
      strokeWidth.addEventListener('change', (e) => {
        this.applyPropertyChange('strokeWidth', parseInt(e.target.value));
      });
    }

    // 边框样式（包括无边框）
    const strokeDash = document.getElementById('prop-stroke-dash');
    if (strokeDash) {
      strokeDash.addEventListener('change', (e) => {
        const obj = this.canvas.getActiveObject();
        if (!obj) return;

        if (e.target.value === 'none') {
          // 无边框
          obj.set({
            stroke: 'transparent',
            strokeWidth: 0
          });
        } else {
          // 有边框 - 恢复边框颜色
          const strokeColor = document.getElementById('prop-stroke')?.value || '#000000';
          const strokeWidth = parseInt(document.getElementById('prop-stroke-width')?.value) || 2;
          const dashArray = e.target.value ? e.target.value.split(',').map(Number) : null;
          obj.set({
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: dashArray
          });
        }
        this.canvas.renderAll();
        this.editor.history.saveState();
      });
    }

    // 透明度
    const opacity = document.getElementById('prop-opacity');
    const opacityValue = document.getElementById('prop-opacity-value');
    if (opacity) {
      opacity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.applyPropertyChange('opacity', val);
        if (opacityValue) opacityValue.textContent = `${Math.round(val * 100)}%`;
      });
    }

    // 阴影
    this.setupShadowInputs();

    // 删除按钮
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteSelected());
    }
  }

  setupShadowInputs() {
    const shadowEnabled = document.getElementById('prop-shadow-enabled');
    const shadowOptions = document.getElementById('shadow-options');

    if (shadowEnabled) {
      shadowEnabled.addEventListener('change', (e) => {
        if (shadowOptions) {
          shadowOptions.classList.toggle('hidden', !e.target.checked);
        }
        this.applyShadow(e.target.checked);
      });
    }

    ['prop-shadow-color', 'prop-shadow-blur', 'prop-shadow-x', 'prop-shadow-y'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.applyShadow(true));
      }
    });
  }

  applyShadow(enabled) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    if (enabled) {
      const color = document.getElementById('prop-shadow-color')?.value || '#000000';
      const blur = parseInt(document.getElementById('prop-shadow-blur')?.value || 10);
      const offsetX = parseInt(document.getElementById('prop-shadow-x')?.value || 5);
      const offsetY = parseInt(document.getElementById('prop-shadow-y')?.value || 5);

      obj.set('shadow', new fabric.Shadow({
        color: color,
        blur: blur,
        offsetX: offsetX,
        offsetY: offsetY
      }));
    } else {
      obj.set('shadow', null);
    }

    this.canvas.renderAll();
    this.editor.history.saveState();
  }

  setupLayerButtons() {
    document.getElementById('bring-front')?.addEventListener('click', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) {
        this.canvas.bringObjectToFront(obj);
        this.canvas.renderAll();
        this.editor.history.saveState();
      }
    });

    document.getElementById('bring-forward')?.addEventListener('click', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) {
        this.canvas.bringObjectForward(obj);
        this.canvas.renderAll();
        this.editor.history.saveState();
      }
    });

    document.getElementById('send-backward')?.addEventListener('click', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) {
        this.canvas.sendObjectBackwards(obj);
        this.canvas.renderAll();
        this.editor.history.saveState();
      }
    });

    document.getElementById('send-back')?.addEventListener('click', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) {
        this.canvas.sendObjectToBack(obj);
        this.canvas.renderAll();
        this.editor.history.saveState();
      }
    });
  }

  setupAlignButtons() {
    document.querySelectorAll('.align-btn[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.alignObjects(btn.dataset.align);
      });
    });

    document.querySelectorAll('.distribute-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.distributeObjects(btn.dataset.distribute);
      });
    });
  }

  alignObjects(alignment) {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    // 如果是选择组，对组内对象进行对齐
    if (activeObject.type === 'activeselection') {
      const objects = activeObject.getObjects();
      if (objects.length < 2) return;

      let bounds = {
        left: Math.min(...objects.map(o => activeObject.left + o.left)),
        right: Math.max(...objects.map(o => activeObject.left + o.left + o.width * o.scaleX)),
        top: Math.min(...objects.map(o => activeObject.top + o.top)),
        bottom: Math.max(...objects.map(o => activeObject.top + o.top + o.height * o.scaleY))
      };

      objects.forEach(obj => {
        switch (alignment) {
          case 'left':
            obj.set('left', bounds.left - activeObject.left);
            break;
          case 'right':
            obj.set('left', bounds.right - activeObject.left - obj.width * obj.scaleX);
            break;
          case 'center-h':
            const centerH = (bounds.left + bounds.right) / 2 - activeObject.left;
            obj.set('left', centerH - (obj.width * obj.scaleX) / 2);
            break;
          case 'top':
            obj.set('top', bounds.top - activeObject.top);
            break;
          case 'bottom':
            obj.set('top', bounds.bottom - activeObject.top - obj.height * obj.scaleY);
            break;
          case 'center-v':
            const centerV = (bounds.top + bounds.bottom) / 2 - activeObject.top;
            obj.set('top', centerV - (obj.height * obj.scaleY) / 2);
            break;
        }
      });
    } else {
      // 单个对象相对画布对齐
      const objWidth = activeObject.width * activeObject.scaleX;
      const objHeight = activeObject.height * activeObject.scaleY;

      switch (alignment) {
        case 'left':
          activeObject.set('left', 0);
          break;
        case 'right':
          activeObject.set('left', canvasWidth - objWidth);
          break;
        case 'center-h':
          activeObject.set('left', (canvasWidth - objWidth) / 2);
          break;
        case 'top':
          activeObject.set('top', 0);
          break;
        case 'bottom':
          activeObject.set('top', canvasHeight - objHeight);
          break;
        case 'center-v':
          activeObject.set('top', (canvasHeight - objHeight) / 2);
          break;
      }
    }

    activeObject.setCoords();
    this.canvas.renderAll();
    this.editor.history.saveState();
  }

  distributeObjects(direction) {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'activeselection') return;

    const objects = activeObject.getObjects();
    if (objects.length < 3) return;

    if (direction === 'horizontal') {
      objects.sort((a, b) => a.left - b.left);
      const first = objects[0];
      const last = objects[objects.length - 1];
      const totalWidth = objects.reduce((sum, obj) => sum + obj.width * obj.scaleX, 0);
      const availableSpace = (last.left + last.width * last.scaleX) - first.left - totalWidth;
      const gap = availableSpace / (objects.length - 1);

      let currentX = first.left + first.width * first.scaleX + gap;
      for (let i = 1; i < objects.length - 1; i++) {
        objects[i].set('left', currentX);
        currentX += objects[i].width * objects[i].scaleX + gap;
      }
    } else {
      objects.sort((a, b) => a.top - b.top);
      const first = objects[0];
      const last = objects[objects.length - 1];
      const totalHeight = objects.reduce((sum, obj) => sum + obj.height * obj.scaleY, 0);
      const availableSpace = (last.top + last.height * last.scaleY) - first.top - totalHeight;
      const gap = availableSpace / (objects.length - 1);

      let currentY = first.top + first.height * first.scaleY + gap;
      for (let i = 1; i < objects.length - 1; i++) {
        objects[i].set('top', currentY);
        currentY += objects[i].height * objects[i].scaleY + gap;
      }
    }

    this.canvas.renderAll();
    this.editor.history.saveState();
  }

  setupGroupButtons() {
    document.getElementById('group-btn')?.addEventListener('click', () => {
      const activeObject = this.canvas.getActiveObject();
      if (!activeObject || activeObject.type !== 'activeselection') return;

      const group = activeObject.toGroup();
      this.canvas.setActiveObject(group);
      this.canvas.renderAll();
      this.editor.history.saveState();
    });

    document.getElementById('ungroup-btn')?.addEventListener('click', () => {
      const activeObject = this.canvas.getActiveObject();
      if (!activeObject || activeObject.type !== 'group') return;

      const items = activeObject.toActiveSelection();
      this.canvas.setActiveObject(items);
      this.canvas.renderAll();
      this.editor.history.saveState();
    });
  }

  /**
   * 判断对象是否为文本类型
   */
  isTextObject(obj) {
    return obj && ['i-text', 'text', 'textbox'].includes(obj.type);
  }

  setupTextProperties() {
    const fontFamily = document.getElementById('prop-font-family');
    if (fontFamily) {
      fontFamily.addEventListener('change', (e) => {
        this.applyTextProperty('fontFamily', e.target.value);
      });
    }

    const fontSize = document.getElementById('prop-font-size');
    if (fontSize) {
      fontSize.addEventListener('change', (e) => {
        this.applyTextProperty('fontSize', parseInt(e.target.value));
      });
    }

    // 文字颜色
    const textColor = document.getElementById('prop-text-color');
    const textColorText = document.getElementById('prop-text-color-text');
    if (textColor) {
      textColor.addEventListener('input', (e) => {
        this.applyTextProperty('fill', e.target.value);
        if (textColorText) textColorText.value = e.target.value;
      });
    }
    if (textColorText) {
      textColorText.addEventListener('change', (e) => {
        this.applyTextProperty('fill', e.target.value);
        if (textColor) textColor.value = e.target.value;
      });
    }

    document.getElementById('prop-bold')?.addEventListener('click', (e) => {
      const obj = this.canvas.getActiveObject();
      if (this.isTextObject(obj)) {
        const isBold = obj.fontWeight === 'bold';
        this.applyTextProperty('fontWeight', isBold ? 'normal' : 'bold');
        e.currentTarget.classList.toggle('active', !isBold);
      }
    });

    document.getElementById('prop-italic')?.addEventListener('click', (e) => {
      const obj = this.canvas.getActiveObject();
      if (this.isTextObject(obj)) {
        const isItalic = obj.fontStyle === 'italic';
        this.applyTextProperty('fontStyle', isItalic ? 'normal' : 'italic');
        e.currentTarget.classList.toggle('active', !isItalic);
      }
    });

    document.getElementById('prop-underline')?.addEventListener('click', (e) => {
      const obj = this.canvas.getActiveObject();
      if (this.isTextObject(obj)) {
        this.applyTextProperty('underline', !obj.underline);
        e.currentTarget.classList.toggle('active', !obj.underline);
      }
    });

    document.getElementById('prop-linethrough')?.addEventListener('click', (e) => {
      const obj = this.canvas.getActiveObject();
      if (this.isTextObject(obj)) {
        this.applyTextProperty('linethrough', !obj.linethrough);
        e.currentTarget.classList.toggle('active', !obj.linethrough);
      }
    });

    document.querySelectorAll('.align-btn[data-text-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyTextProperty('textAlign', btn.dataset.textAlign);
        document.querySelectorAll('.align-btn[data-text-align]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      });
    });

    const lineHeight = document.getElementById('prop-line-height');
    if (lineHeight) {
      lineHeight.addEventListener('change', (e) => {
        this.applyTextProperty('lineHeight', parseFloat(e.target.value));
      });
    }

    const textBg = document.getElementById('prop-text-bg');
    const textBgEnabled = document.getElementById('prop-text-bg-enabled');
    if (textBg && textBgEnabled) {
      const applyBg = () => {
        const obj = this.canvas.getActiveObject();
        if (this.isTextObject(obj)) {
          if (textBgEnabled.checked) {
            this.applyTextProperty('backgroundColor', textBg.value);
          } else {
            this.applyTextProperty('backgroundColor', 'transparent');
          }
        }
      };
      textBg.addEventListener('input', applyBg);
      textBgEnabled.addEventListener('change', applyBg);
    }
  }

  applyTextProperty(property, value) {
    const obj = this.canvas.getActiveObject();
    if (this.isTextObject(obj)) {
      // 如果修改的是占位符文本框，且不是样式属性，先清除占位符状态
      if (obj._isPlaceholder && !['fontWeight', 'fontStyle', 'underline', 'linethrough', 'textAlign'].includes(property)) {
        obj.set({
          text: '',
          _isPlaceholder: false
        });
      }
      obj.set(property, value);
      this.canvas.renderAll();
      this.editor.history.saveState();
    }
  }

  onSelectionChange(e) {
    this.selectedObject = e.selected[0];
    this.showObjectProperties();
    this.updatePropertyValues();
  }

  onSelectionClear() {
    this.selectedObject = null;
    this.hideObjectProperties();
  }

  showObjectProperties() {
    document.getElementById('no-selection')?.classList.add('hidden');
    document.getElementById('object-properties')?.classList.remove('hidden');

    const obj = this.canvas.getActiveObject();
    if (obj) {
      // 显示文本属性面板
      const textProps = document.getElementById('text-properties');
      if (textProps) {
        textProps.classList.toggle('hidden', !this.isTextObject(obj));
      }

      // 显示图片滤镜面板
      const imageFilters = document.getElementById('image-filters');
      if (imageFilters) {
        imageFilters.classList.toggle('hidden', obj.type !== 'image');
        if (obj.type === 'image') {
          this.editor.filterManager.updateFilterUI(obj);
        }
      }
    }
  }

  hideObjectProperties() {
    document.getElementById('no-selection')?.classList.remove('hidden');
    document.getElementById('object-properties')?.classList.add('hidden');
    document.getElementById('text-properties')?.classList.add('hidden');
    document.getElementById('image-filters')?.classList.add('hidden');
  }

  updatePropertyValues() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    // 位置和尺寸
    document.getElementById('prop-x').value = Math.round(obj.left);
    document.getElementById('prop-y').value = Math.round(obj.top);
    document.getElementById('prop-width').value = Math.round(obj.width * obj.scaleX);
    document.getElementById('prop-height').value = Math.round(obj.height * obj.scaleY);
    document.getElementById('prop-angle').value = Math.round(obj.angle);

    // 颜色
    const fill = obj.fill || '#000000';
    const stroke = obj.stroke || '#000000';

    const fillInput = document.getElementById('prop-fill');
    const fillText = document.getElementById('prop-fill-text');
    if (fillInput && typeof fill === 'string') {
      fillInput.value = fill;
      if (fillText) fillText.value = fill;
    }

    const strokeInput = document.getElementById('prop-stroke');
    const strokeText = document.getElementById('prop-stroke-text');
    if (strokeInput && typeof stroke === 'string') {
      strokeInput.value = stroke;
      if (strokeText) strokeText.value = stroke;
    }

    // 描边
    const strokeWidth = document.getElementById('prop-stroke-width');
    if (strokeWidth) strokeWidth.value = obj.strokeWidth || 0;

    const strokeDash = document.getElementById('prop-stroke-dash');
    if (strokeDash) {
      // 检查是否为无边框
      if (!obj.stroke || obj.stroke === 'transparent' || obj.strokeWidth === 0) {
        strokeDash.value = 'none';
      } else if (obj.strokeDashArray) {
        strokeDash.value = obj.strokeDashArray.join(',');
      } else {
        strokeDash.value = '';  // 实线
      }
    }

    // 透明度
    const opacity = document.getElementById('prop-opacity');
    const opacityValue = document.getElementById('prop-opacity-value');
    if (opacity) {
      opacity.value = obj.opacity;
      if (opacityValue) opacityValue.textContent = `${Math.round(obj.opacity * 100)}%`;
    }

    // 阴影
    const shadowEnabled = document.getElementById('prop-shadow-enabled');
    const shadowOptions = document.getElementById('shadow-options');
    if (shadowEnabled) {
      const hasShadow = !!obj.shadow;
      shadowEnabled.checked = hasShadow;
      if (shadowOptions) shadowOptions.classList.toggle('hidden', !hasShadow);

      if (hasShadow && obj.shadow) {
        document.getElementById('prop-shadow-color').value = obj.shadow.color || '#000000';
        document.getElementById('prop-shadow-blur').value = obj.shadow.blur || 0;
        document.getElementById('prop-shadow-x').value = obj.shadow.offsetX || 0;
        document.getElementById('prop-shadow-y').value = obj.shadow.offsetY || 0;
      }
    }

    // 文本属性
    if (this.isTextObject(obj)) {
      this.updateTextPropertyValues(obj);
    }
  }

  updateTextPropertyValues(obj) {
    const fontFamily = document.getElementById('prop-font-family');
    if (fontFamily) fontFamily.value = obj.fontFamily || 'Arial';

    const fontSize = document.getElementById('prop-font-size');
    if (fontSize) fontSize.value = obj.fontSize || 24;

    // 文字颜色
    const textColor = document.getElementById('prop-text-color');
    const textColorText = document.getElementById('prop-text-color-text');
    const fillColor = obj.fill || '#000000';
    if (textColor && typeof fillColor === 'string') {
      textColor.value = fillColor;
    }
    if (textColorText && typeof fillColor === 'string') {
      textColorText.value = fillColor;
    }

    document.getElementById('prop-bold')?.classList.toggle('active', obj.fontWeight === 'bold');
    document.getElementById('prop-italic')?.classList.toggle('active', obj.fontStyle === 'italic');
    document.getElementById('prop-underline')?.classList.toggle('active', obj.underline);
    document.getElementById('prop-linethrough')?.classList.toggle('active', obj.linethrough);

    document.querySelectorAll('.align-btn[data-text-align]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.textAlign === obj.textAlign);
    });

    const lineHeight = document.getElementById('prop-line-height');
    if (lineHeight) lineHeight.value = obj.lineHeight || 1.2;

    // 背景色
    const textBg = document.getElementById('prop-text-bg');
    const textBgEnabled = document.getElementById('prop-text-bg-enabled');
    if (textBg && textBgEnabled) {
      const hasBg = obj.backgroundColor && obj.backgroundColor !== 'transparent';
      textBgEnabled.checked = hasBg;
      if (hasBg) {
        textBg.value = obj.backgroundColor;
      }
    }
  }

  applyPropertyChange(property, value) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    switch (property) {
      case 'prop-x':
        obj.set('left', parseFloat(value));
        break;
      case 'prop-y':
        obj.set('top', parseFloat(value));
        break;
      case 'prop-width':
        obj.set('scaleX', parseFloat(value) / obj.width);
        break;
      case 'prop-height':
        obj.set('scaleY', parseFloat(value) / obj.height);
        break;
      case 'prop-angle':
        obj.set('angle', parseFloat(value));
        break;
      default:
        obj.set(property, value);
    }

    obj.setCoords();
    this.canvas.renderAll();
    this.editor.history.saveState();
  }

  deleteSelected() {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    if (activeObject.type === 'activeselection') {
      activeObject.forEachObject(obj => {
        this.canvas.remove(obj);
      });
    } else {
      this.canvas.remove(activeObject);
    }

    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this.editor.history.saveState();
  }
}
