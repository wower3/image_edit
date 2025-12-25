import * as fabric from 'fabric';

/**
 * Tools Manager - 工具管理系统
 */
export class ToolsManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;
    this.currentTool = 'select';
    this.isDrawingShape = false;
    this.startPoint = null;
    this.currentShape = null;

    this.brushSettings = {
      color: '#000000',
      width: 5
    };

    this.setupTools();
  }

  setupTools() {
    // 监听工具栏按钮点击
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) this.setTool(tool);
      });
    });

    // 画笔设置
    const brushColorInput = document.getElementById('brush-color');
    const brushWidthInput = document.getElementById('brush-width');
    const brushWidthValue = document.getElementById('brush-width-value');

    if (brushColorInput) {
      brushColorInput.addEventListener('input', (e) => {
        this.brushSettings.color = e.target.value;
        if (this.canvas.freeDrawingBrush) {
          this.canvas.freeDrawingBrush.color = e.target.value;
        }
        // 更新光标
        if (this.canvas.isDrawingMode) {
          this.updateBrushCursor();
        }
      });
    }

    if (brushWidthInput) {
      brushWidthInput.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        this.brushSettings.width = width;
        if (brushWidthValue) brushWidthValue.textContent = `${width}px`;
        if (this.canvas.freeDrawingBrush) {
          this.canvas.freeDrawingBrush.width = width;
        }
        // 更新光标
        if (this.canvas.isDrawingMode) {
          this.updateBrushCursor();
        }
      });
    }

    // 图形绘制事件
    this.canvas.on('mouse:down', (opt) => this.onMouseDown(opt));
    this.canvas.on('mouse:move', (opt) => this.onMouseMove(opt));
    this.canvas.on('mouse:up', (opt) => this.onMouseUp(opt));
  }

  setTool(toolName) {
    this.currentTool = toolName;

    // 更新工具栏UI
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    // 重置画布状态
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;
    this.canvas.defaultCursor = 'default';
    this.canvas.hoverCursor = 'move';

    // 隐藏所有工具面板
    this.hideAllPanels();

    switch (toolName) {
      case 'select':
        this.canvas.forEachObject(obj => {
          obj.selectable = true;
          obj.evented = true;
        });
        break;

      case 'hand':
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'grab';
        this.canvas.forEachObject(obj => {
          obj.selectable = false;
          obj.evented = false;
        });
        break;

      case 'pencil':
        this.enableDrawingMode('pencil');
        this.showPanel('brush-settings');
        break;

      case 'eraser':
        this.enableDrawingMode('eraser');
        this.showPanel('brush-settings');
        break;

      case 'rect':
      case 'circle':
      case 'triangle':
      case 'line':
      case 'arrow':
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        break;

      case 'text':
        this.canvas.defaultCursor = 'text';
        break;

      case 'image':
        document.getElementById('image-input').click();
        this.setTool('select');
        break;

      case 'crop':
        // 裁剪需要先获取选中的图片，不能取消选择
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && this.editor.cropManager.isImageObject(activeObject)) {
          this.showPanel('crop-panel');
          this.editor.cropManager.enableCropMode();
        } else {
          this.editor.showToast('请先选择一张图片再进行裁剪', 'error');
          this.setTool('select');
        }
        return; // 直接返回，不取消选择
    }

    // 取消当前选择（裁剪工具除外）
    if (toolName !== 'select') {
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
    }
  }

  enableDrawingMode(mode) {
    this.canvas.isDrawingMode = true;

    if (mode === 'pencil') {
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.color = this.brushSettings.color;
      this.canvas.freeDrawingBrush.width = this.brushSettings.width;
    } else if (mode === 'eraser') {
      // Fabric v6 原生支持橡皮擦
      if (fabric.EraserBrush) {
        this.canvas.freeDrawingBrush = new fabric.EraserBrush(this.canvas);
        this.canvas.freeDrawingBrush.width = this.brushSettings.width;
      } else {
        // 回退方案：使用白色画笔模拟橡皮擦
        this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
        this.canvas.freeDrawingBrush.color = '#ffffff';
        this.canvas.freeDrawingBrush.width = this.brushSettings.width;
      }
    }

    // 设置画笔光标显示半径
    this.updateBrushCursor();
  }

  /**
   * 更新画笔光标以显示半径
   */
  updateBrushCursor() {
    const width = this.brushSettings.width;
    const color = this.currentTool === 'eraser' ? '#888888' : this.brushSettings.color;

    // 创建圆形光标的 canvas
    const cursorSize = Math.max(width, 4);
    const cursorCanvas = document.createElement('canvas');
    cursorCanvas.width = cursorSize + 4;
    cursorCanvas.height = cursorSize + 4;
    const ctx = cursorCanvas.getContext('2d');

    // 绘制圆形边框
    ctx.beginPath();
    ctx.arc(cursorCanvas.width / 2, cursorCanvas.height / 2, cursorSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 绘制中心点
    ctx.beginPath();
    ctx.arc(cursorCanvas.width / 2, cursorCanvas.height / 2, 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // 设置光标
    const dataUrl = cursorCanvas.toDataURL();
    const hotspot = Math.floor(cursorCanvas.width / 2);
    this.canvas.freeDrawingCursor = `url(${dataUrl}) ${hotspot} ${hotspot}, crosshair`;
  }

  hideAllPanels() {
    ['brush-settings', 'crop-panel'].forEach(id => {
      const panel = document.getElementById(id);
      if (panel) panel.classList.add('hidden');
    });
  }

  showPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.remove('hidden');
  }

  onMouseDown(opt) {
    // 如果点击了现有对象，不创建新形状，而是选中该对象
    if (opt.target) {
      // 点击了现有对象，切换到选择模式
      if (['rect', 'circle', 'triangle', 'line', 'arrow', 'text'].includes(this.currentTool)) {
        this.canvas.setActiveObject(opt.target);
        this.canvas.renderAll();
        return;
      }
    }

    if (['rect', 'circle', 'triangle', 'line', 'arrow'].includes(this.currentTool)) {
      this.isDrawingShape = true;
      const pointer = this.canvas.getPointer(opt.e);
      this.startPoint = { x: pointer.x, y: pointer.y };
      this.createShape(pointer);
    } else if (this.currentTool === 'text') {
      const pointer = this.canvas.getPointer(opt.e);
      this.addText(pointer);
    } else if (this.currentTool === 'hand') {
      this.editor.isPanning = true;
      this.canvas.defaultCursor = 'grabbing';
    }
  }

  onMouseMove(opt) {
    if (!this.isDrawingShape || !this.currentShape) return;

    const pointer = this.canvas.getPointer(opt.e);
    this.updateShape(pointer);
    this.canvas.renderAll();
  }

  onMouseUp(opt) {
    if (this.isDrawingShape && this.currentShape) {
      this.isDrawingShape = false;
      this.currentShape.setCoords();
      this.editor.history.saveState();
      this.currentShape = null;
      this.startPoint = null;
    }

    if (this.currentTool === 'hand') {
      this.editor.isPanning = false;
      this.canvas.defaultCursor = 'grab';
    }
  }

  createShape(pointer) {
    let shape;
    const commonProps = {
      left: pointer.x,
      top: pointer.y,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      originX: 'left',
      originY: 'top'
    };

    switch (this.currentTool) {
      case 'rect':
        shape = new fabric.Rect({
          ...commonProps,
          width: 0,
          height: 0
        });
        break;

      case 'circle':
        shape = new fabric.Ellipse({
          ...commonProps,
          rx: 0,
          ry: 0
        });
        break;

      case 'triangle':
        shape = new fabric.Triangle({
          ...commonProps,
          width: 0,
          height: 0
        });
        break;

      case 'line':
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: '#000000',
          strokeWidth: 2,
          selectable: true
        });
        break;

      case 'arrow':
        shape = this.createArrow(pointer.x, pointer.y, pointer.x, pointer.y);
        break;
    }

    if (shape) {
      this.canvas.add(shape);
      this.currentShape = shape;
    }
  }

  createArrow(x1, y1, x2, y2) {
    const headLen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: '#000000',
      strokeWidth: 2
    });

    const arrowHead = new fabric.Triangle({
      left: x2,
      top: y2,
      angle: (angle * 180 / Math.PI) + 90,
      width: headLen,
      height: headLen,
      fill: '#000000',
      originX: 'center',
      originY: 'center'
    });

    const group = new fabric.Group([line, arrowHead], {
      selectable: true,
      name: 'arrow'
    });

    return group;
  }

  updateShape(pointer) {
    const { x: startX, y: startY } = this.startPoint;
    const width = pointer.x - startX;
    const height = pointer.y - startY;

    switch (this.currentTool) {
      case 'rect':
        if (width < 0) {
          this.currentShape.set('left', pointer.x);
          this.currentShape.set('width', Math.abs(width));
        } else {
          this.currentShape.set('width', width);
        }
        if (height < 0) {
          this.currentShape.set('top', pointer.y);
          this.currentShape.set('height', Math.abs(height));
        } else {
          this.currentShape.set('height', height);
        }
        break;

      case 'circle':
        const rx = Math.abs(width) / 2;
        const ry = Math.abs(height) / 2;
        this.currentShape.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          rx: rx,
          ry: ry
        });
        break;

      case 'triangle':
        if (width < 0) {
          this.currentShape.set('left', pointer.x);
          this.currentShape.set('width', Math.abs(width));
        } else {
          this.currentShape.set('width', width);
        }
        if (height < 0) {
          this.currentShape.set('top', pointer.y);
          this.currentShape.set('height', Math.abs(height));
        } else {
          this.currentShape.set('height', height);
        }
        break;

      case 'line':
        this.currentShape.set({ x2: pointer.x, y2: pointer.y });
        break;

      case 'arrow':
        // 重新创建箭头
        this.canvas.remove(this.currentShape);
        this.currentShape = this.createArrow(startX, startY, pointer.x, pointer.y);
        this.canvas.add(this.currentShape);
        break;
    }
  }

  addText(pointer) {
    const text = new fabric.IText('双击编辑文本', {
      left: pointer.x,
      top: pointer.y,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000'
    });

    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    text.enterEditing();
    this.editor.history.saveState();
    this.setTool('select');
  }
}
