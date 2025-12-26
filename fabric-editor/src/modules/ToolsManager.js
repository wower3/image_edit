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

    // 默认文本/气泡样式
    this.textShapeDefaults = {
      fontSize: 16,
      fontFamily: 'Microsoft YaHei, Arial, sans-serif',
      textColor: '#000000',
      borderColor: '#333333',
      borderWidth: 2,
      fillColor: '#ffffff',
      borderStyle: 'solid' // solid, dashed, dotted
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
      case 'bubble':
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
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
      if (['rect', 'circle', 'triangle', 'line', 'arrow', 'text', 'bubble'].includes(this.currentTool)) {
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
      // 开始拖拽创建文本框
      this.isDrawingShape = true;
      const pointer = this.canvas.getPointer(opt.e);
      this.startPoint = { x: pointer.x, y: pointer.y };
      this.createTextBox(pointer);
    } else if (this.currentTool === 'bubble') {
      // 创建气泡形状
      this.isDrawingShape = true;
      const pointer = this.canvas.getPointer(opt.e);
      this.startPoint = { x: pointer.x, y: pointer.y };
      this.createBubble(pointer);
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

      // 根据工具类型完成形状创建
      if (this.currentTool === 'text') {
        this.finalizeTextBox();
      } else if (this.currentTool === 'bubble') {
        this.finalizeBubble();
      } else if (['rect', 'circle', 'triangle'].includes(this.currentTool)) {
        this.finalizeShapeWithText();
      } else {
        this.currentShape.setCoords();
      }

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
      fill: this.textShapeDefaults.fillColor,
      stroke: this.textShapeDefaults.borderColor,
      strokeWidth: this.textShapeDefaults.borderWidth,
      originX: 'left',
      originY: 'top'
    };

    switch (this.currentTool) {
      case 'rect':
        shape = new fabric.Rect({
          ...commonProps,
          width: 0,
          height: 0,
          _shapeType: 'rect'
        });
        break;

      case 'circle':
        shape = new fabric.Ellipse({
          ...commonProps,
          rx: 0,
          ry: 0,
          _shapeType: 'circle'
        });
        break;

      case 'triangle':
        shape = new fabric.Triangle({
          ...commonProps,
          width: 0,
          height: 0,
          _shapeType: 'triangle'
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

      case 'text':
        // 更新文本框大小
        const textWidth = Math.abs(width);
        this.currentShape.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.max(textWidth, 50) // 最小宽度50
        });
        break;

      case 'bubble':
        // 更新气泡大小
        this.updateBubbleSize(pointer);
        break;
    }
  }

  /**
   * 创建文本框（PPT风格）
   * 支持：边框样式、边框颜色、填充颜色、字体、字号、字颜色
   */
  createTextBox(pointer) {
    const textbox = new fabric.Textbox('', {
      left: pointer.x,
      top: pointer.y,
      width: 150,
      minWidth: 50,
      fontSize: this.textShapeDefaults.fontSize,
      fontFamily: this.textShapeDefaults.fontFamily,
      fill: this.textShapeDefaults.textColor,
      // 边框样式 - 默认显示边框便于选中
      stroke: this.textShapeDefaults.borderColor,
      strokeWidth: this.textShapeDefaults.borderWidth,
      strokeDashArray: null,
      // 填充背景 - 使用透明但有点击区域
      backgroundColor: this.textShapeDefaults.fillColor,
      // 可编辑设置
      editable: true,
      // 内边距 - 增加点击区域
      padding: 10,
      // 固定宽度，高度自适应
      splitByGrapheme: true,
      // 自定义属性
      _isPlaceholder: true,
      _shapeType: 'textbox',
      // 控制点样式
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      cornerSize: 8,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#4f46e5',
      borderScaleFactor: 1.5,
      // 增加选中区域 - perPixelTargetFind 设为 false 可以让整个边界框都可点击
      perPixelTargetFind: false
    });

    this.canvas.add(textbox);
    this.currentShape = textbox;
  }

  /**
   * 完成文本框创建
   */
  finalizeTextBox() {
    if (this.currentShape && this.currentShape.type === 'textbox') {
      const textbox = this.currentShape;

      // 如果拖拽区域太小，设置默认大小
      if (textbox.width < 80) {
        textbox.set({ width: 150 });
      }

      // 设置占位文本（灰色斜体）
      textbox.set({
        text: '点击输入文本',
        fill: '#999999',
        fontStyle: 'italic',
        _isPlaceholder: true
      });

      textbox.setCoords();
      this.canvas.setActiveObject(textbox);
      this.canvas.renderAll();

      // 绑定文本框事件
      this.setupTextBoxEvents(textbox);

      // 自动进入编辑模式
      setTimeout(() => {
        textbox.enterEditing();
        textbox.selectAll();
        this.canvas.renderAll();
      }, 50);
    }
  }

  /**
   * 设置文本框事件（PPT风格交互）
   */
  setupTextBoxEvents(textbox) {
    const self = this;

    // 进入编辑模式时
    textbox.on('editing:entered', () => {
      // 如果是占位符状态，清空文本并恢复正常样式
      if (textbox._isPlaceholder) {
        textbox.set({
          text: '',
          fill: self.textShapeDefaults.textColor,
          fontStyle: 'normal',
          _isPlaceholder: false
        });
        self.canvas.renderAll();
      }
    });

    // 退出编辑模式时
    textbox.on('editing:exited', () => {
      // 如果文本为空，恢复占位符
      if (!textbox.text || textbox.text.trim() === '') {
        textbox.set({
          text: '点击输入文本',
          fill: '#999999',
          fontStyle: 'italic',
          _isPlaceholder: true
        });
      }
      self.canvas.renderAll();
      self.editor.history.saveState();
    });
  }

  /**
   * 创建气泡形状（带尖角的对话框）
   */
  createBubble(pointer) {
    const defaultWidth = 150;
    const defaultHeight = 80;
    const tailSize = 15;

    // 创建气泡路径
    const bubblePath = this.createBubblePath(0, 0, defaultWidth, defaultHeight, 10, tailSize);

    const bubble = new fabric.Path(bubblePath, {
      left: pointer.x,
      top: pointer.y,
      fill: this.textShapeDefaults.fillColor,
      stroke: this.textShapeDefaults.borderColor,
      strokeWidth: this.textShapeDefaults.borderWidth,
      originX: 'left',
      originY: 'top',
      // 自定义属性
      _shapeType: 'bubble',
      _bubbleWidth: defaultWidth,
      _bubbleHeight: defaultHeight,
      _tailSize: tailSize,
      // 控制点样式
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      cornerSize: 8,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#4f46e5'
    });

    this.canvas.add(bubble);
    this.currentShape = bubble;
  }

  /**
   * 创建气泡SVG路径
   */
  createBubblePath(x, y, width, height, radius, tailSize) {
    const r = Math.min(radius, width / 2, height / 2);
    const tailWidth = tailSize * 1.5;
    const tailHeight = tailSize;

    // 气泡主体 + 底部尖角
    return `
      M ${x + r} ${y}
      L ${x + width - r} ${y}
      Q ${x + width} ${y} ${x + width} ${y + r}
      L ${x + width} ${y + height - r}
      Q ${x + width} ${y + height} ${x + width - r} ${y + height}
      L ${x + width / 2 + tailWidth / 2} ${y + height}
      L ${x + width / 2} ${y + height + tailHeight}
      L ${x + width / 2 - tailWidth / 2} ${y + height}
      L ${x + r} ${y + height}
      Q ${x} ${y + height} ${x} ${y + height - r}
      L ${x} ${y + r}
      Q ${x} ${y} ${x + r} ${y}
      Z
    `;
  }

  /**
   * 更新气泡大小
   */
  updateBubbleSize(pointer) {
    const { x: startX, y: startY } = this.startPoint;
    const width = Math.max(Math.abs(pointer.x - startX), 80);
    const height = Math.max(Math.abs(pointer.y - startY), 50);

    const left = Math.min(startX, pointer.x);
    const top = Math.min(startY, pointer.y);

    const tailSize = this.currentShape._tailSize || 15;
    const newPath = this.createBubblePath(0, 0, width, height, 10, tailSize);

    // 更新路径
    this.currentShape.set({
      path: fabric.util.parsePath(newPath),
      left: left,
      top: top,
      _bubbleWidth: width,
      _bubbleHeight: height
    });

    this.currentShape.setCoords();
  }

  /**
   * 完成气泡创建
   */
  finalizeBubble() {
    if (this.currentShape && this.currentShape._shapeType === 'bubble') {
      const bubble = this.currentShape;

      // 确保最小尺寸
      let width = bubble._bubbleWidth || 150;
      let height = bubble._bubbleHeight || 80;

      if (width < 100) width = 150;
      if (height < 60) height = 80;

      const tailSize = bubble._tailSize || 15;
      const newPath = this.createBubblePath(0, 0, width, height, 10, tailSize);

      bubble.set({
        path: fabric.util.parsePath(newPath),
        _bubbleWidth: width,
        _bubbleHeight: height
      });

      bubble.setCoords();

      // 创建绑定的文本框
      this.createBoundTextForBubble(bubble);
    }
  }

  /**
   * 完成形状创建（矩形、圆形、三角形）并添加绑定文本
   */
  finalizeShapeWithText() {
    const shape = this.currentShape;
    if (!shape) return;

    // 确保最小尺寸
    let width, height;
    if (shape.type === 'ellipse') {
      width = shape.rx * 2;
      height = shape.ry * 2;
      if (width < 60) {
        shape.set('rx', 50);
        width = 100;
      }
      if (height < 40) {
        shape.set('ry', 40);
        height = 80;
      }
    } else {
      width = shape.width;
      height = shape.height;
      if (width < 60) {
        shape.set('width', 100);
        width = 100;
      }
      if (height < 40) {
        shape.set('height', 80);
        height = 80;
      }
    }

    shape.setCoords();

    // 创建绑定的文本框
    this.createBoundTextForShape(shape);
  }

  /**
   * 为形状创建绑定的文本框（通用方法）
   */
  createBoundTextForShape(shape) {
    const bounds = shape.getBoundingRect();
    const width = bounds.width / (shape.scaleX || 1);
    const height = bounds.height / (shape.scaleY || 1);

    // 创建内嵌文本框 - 透明背景和边框
    const textbox = new fabric.Textbox('', {
      originX: 'center',
      originY: 'center',
      width: Math.max(width * 0.8, 50),
      fontSize: this.textShapeDefaults.fontSize,
      fontFamily: this.textShapeDefaults.fontFamily,
      fill: this.textShapeDefaults.textColor,
      textAlign: 'center',
      // 透明边框和背景
      stroke: null,
      strokeWidth: 0,
      backgroundColor: 'transparent',
      // 文本设置
      editable: true,
      splitByGrapheme: true,
      _isPlaceholder: false,
      _shapeType: 'shapeText',
      // 隐藏控制点，只能通过形状控制
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      selectable: true,
      evented: true
    });

    // 计算文本位置（形状中心）
    this.updateTextPositionForShape(shape, textbox);

    this.canvas.add(textbox);

    // 建立双向关联
    shape._boundText = textbox;
    textbox._boundShape = shape;

    // 绑定形状事件 - 文本跟随
    this.bindShapeTextEvents(shape, textbox);

    // 绑定文本编辑事件
    this.setupShapeTextEvents(textbox);

    this.canvas.setActiveObject(shape);
    this.canvas.renderAll();
  }

  /**
   * 更新文本在形状中的位置
   */
  updateTextPositionForShape(shape, textbox) {
    const shapeCenter = shape.getCenterPoint();

    textbox.set({
      left: shapeCenter.x,
      top: shapeCenter.y,
      scaleX: shape.scaleX,
      scaleY: shape.scaleY,
      angle: shape.angle
    });
    textbox.setCoords();
  }

  /**
   * 绑定形状和文本的联动事件
   */
  bindShapeTextEvents(shape, textbox) {
    const self = this;

    // 形状移动时，文本跟随
    shape.on('moving', () => {
      self.updateTextPositionForShape(shape, textbox);
      self.canvas.renderAll();
    });

    // 形状缩放时，文本跟随
    shape.on('scaling', () => {
      self.updateTextPositionForShape(shape, textbox);
      self.canvas.renderAll();
    });

    // 形状旋转时，文本跟随
    shape.on('rotating', () => {
      self.updateTextPositionForShape(shape, textbox);
      self.canvas.renderAll();
    });

    // 形状修改后，更新文本位置
    shape.on('modified', () => {
      self.updateTextPositionForShape(shape, textbox);
      self.canvas.renderAll();
    });

    // 形状被删除时，删除文本
    shape.on('removed', () => {
      if (textbox && self.canvas.contains(textbox)) {
        self.canvas.remove(textbox);
      }
    });

    // 双击形状进入文本编辑
    shape.on('mousedblclick', () => {
      if (textbox) {
        self.canvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll();
        self.canvas.renderAll();
      }
    });
  }

  /**
   * 设置形状文本的编辑事件
   */
  setupShapeTextEvents(textbox) {
    const self = this;

    // 退出编辑模式时
    textbox.on('editing:exited', () => {
      self.canvas.renderAll();
      self.editor.history.saveState();

      // 退出编辑后选中形状
      if (textbox._boundShape) {
        setTimeout(() => {
          self.canvas.setActiveObject(textbox._boundShape);
          self.canvas.renderAll();
        }, 50);
      }
    });

    // 文本被删除时，也删除形状
    textbox.on('removed', () => {
      const shape = textbox._boundShape;
      if (shape && self.canvas.contains(shape)) {
        self.canvas.remove(shape);
      }
    });
  }

  /**
   * 为气泡创建绑定的文本框
   */
  createBoundTextForBubble(bubble) {
    const width = bubble._bubbleWidth || 150;
    const height = bubble._bubbleHeight || 80;

    // 创建内嵌文本框 - 透明背景和边框
    const textbox = new fabric.Textbox('点击输入文本', {
      originX: 'center',
      originY: 'center',
      width: width - 30,
      fontSize: this.textShapeDefaults.fontSize,
      fontFamily: this.textShapeDefaults.fontFamily,
      fill: '#999999',
      fontStyle: 'italic',
      textAlign: 'center',
      // 透明边框和背景
      stroke: null,
      strokeWidth: 0,
      backgroundColor: 'transparent',
      // 文本设置
      editable: true,
      splitByGrapheme: true,
      _isPlaceholder: true,
      _shapeType: 'bubbleText',
      // 隐藏控制点，只能通过气泡控制
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      selectable: true,
      evented: true
    });

    // 计算文本位置（气泡中心）
    this.updateTextPositionForBubble(bubble, textbox);

    this.canvas.add(textbox);

    // 建立双向关联
    bubble._boundText = textbox;
    textbox._boundBubble = bubble;

    // 绑定气泡事件 - 文本跟随
    this.bindBubbleTextEvents(bubble, textbox);

    // 绑定文本编辑事件
    this.setupBubbleTextEvents(textbox);

    this.canvas.setActiveObject(bubble);
    this.canvas.renderAll();

    // 自动进入文本编辑模式
    setTimeout(() => {
      this.canvas.setActiveObject(textbox);
      textbox.enterEditing();
      textbox.selectAll();
      this.canvas.renderAll();
    }, 100);
  }

  /**
   * 更新文本在气泡中的位置
   */
  updateTextPositionForBubble(bubble, textbox) {
    const bubbleCenter = bubble.getCenterPoint();
    const height = bubble._bubbleHeight || 80;
    const tailSize = bubble._tailSize || 15;

    // 文本放在气泡主体中心（不包括尖角）
    textbox.set({
      left: bubbleCenter.x,
      top: bubbleCenter.y - (tailSize / 2) * bubble.scaleY,
      scaleX: bubble.scaleX,
      scaleY: bubble.scaleY,
      angle: bubble.angle
    });
    textbox.setCoords();
  }

  /**
   * 绑定气泡和文本的联动事件
   */
  bindBubbleTextEvents(bubble, textbox) {
    const self = this;

    // 气泡移动时，文本跟随
    bubble.on('moving', () => {
      self.updateTextPositionForBubble(bubble, textbox);
      self.canvas.renderAll();
    });

    // 气泡缩放时，文本跟随
    bubble.on('scaling', () => {
      self.updateTextPositionForBubble(bubble, textbox);
      self.canvas.renderAll();
    });

    // 气泡旋转时，文本跟随
    bubble.on('rotating', () => {
      self.updateTextPositionForBubble(bubble, textbox);
      self.canvas.renderAll();
    });

    // 气泡修改后，更新文本位置
    bubble.on('modified', () => {
      self.updateTextPositionForBubble(bubble, textbox);
      self.canvas.renderAll();
    });

    // 气泡被删除时，删除文本
    bubble.on('removed', () => {
      if (textbox && self.canvas.contains(textbox)) {
        self.canvas.remove(textbox);
      }
    });

    // 选中气泡时，也显示文本可选
    bubble.on('selected', () => {
      // 高亮显示关联
      bubble.set({ borderColor: '#4f46e5' });
    });

    // 双击气泡进入文本编辑
    bubble.on('mousedblclick', () => {
      if (textbox) {
        self.canvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll();
        self.canvas.renderAll();
      }
    });
  }

  /**
   * 设置气泡文本的编辑事件
   */
  setupBubbleTextEvents(textbox) {
    const self = this;

    // 进入编辑模式时
    textbox.on('editing:entered', () => {
      // 如果是占位符，清空并设置正常样式
      if (textbox._isPlaceholder) {
        textbox.set({
          text: '',
          fill: self.textShapeDefaults.textColor,
          fontStyle: 'normal',
          _isPlaceholder: false
        });
        self.canvas.renderAll();
      }
    });

    // 退出编辑模式时
    textbox.on('editing:exited', () => {
      // 如果文本为空，恢复占位符
      if (!textbox.text || textbox.text.trim() === '') {
        textbox.set({
          text: '点击输入文本',
          fill: '#999999',
          fontStyle: 'italic',
          _isPlaceholder: true
        });
      }
      self.canvas.renderAll();
      self.editor.history.saveState();

      // 退出编辑后选中气泡
      if (textbox._boundBubble) {
        setTimeout(() => {
          self.canvas.setActiveObject(textbox._boundBubble);
          self.canvas.renderAll();
        }, 50);
      }
    });

    // 文本被删除时，也删除气泡
    textbox.on('removed', () => {
      const bubble = textbox._boundBubble;
      if (bubble && self.canvas.contains(bubble)) {
        self.canvas.remove(bubble);
      }
    });
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
