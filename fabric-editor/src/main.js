import * as fabric from 'fabric';
import { HistoryManager } from './modules/HistoryManager.js';
import { ToolsManager } from './modules/ToolsManager.js';
import { PropertiesManager } from './modules/PropertiesManager.js';
import { FilterManager } from './modules/FilterManager.js';
import { CropManager } from './modules/CropManager.js';
import { IOManager } from './modules/IOManager.js';

/**
 * Fabric Image Editor - 主编辑器类
 */
class FabricEditor {
  constructor() {
    this.canvasWidth = 1200;
    this.canvasHeight = 800;
    this.zoom = 1;
    this.isPanning = false;
    this.lastPosX = 0;
    this.lastPosY = 0;

    this.init();
  }

  async init() {
    await this.createCanvas();
    this.setupManagers();
    this.setupZoomControls();
    this.setupCanvasSizeControls();
    this.setupKeyboardShortcuts();
    this.setupCanvasEvents();
    this.customizeControls();

    // 初始化历史记录（立即保存初始状态）
    this.history.saveStateImmediate();

    // 添加Toast容器
    this.createToastContainer();

    console.log('Fabric Editor initialized');
  }

  async createCanvas() {
    const wrapper = document.getElementById('canvas-workspace');
    const container = document.getElementById('canvas-wrapper');

    // 设置工作区尺寸
    wrapper.style.width = `${this.canvasWidth}px`;
    wrapper.style.height = `${this.canvasHeight}px`;

    // 创建Fabric画布
    this.canvas = new fabric.Canvas('fabric-canvas', {
      width: this.canvasWidth,
      height: this.canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true
    });

    // 设置背景颜色输入
    const bgColorInput = document.getElementById('canvas-bg-color');
    if (bgColorInput) {
      bgColorInput.addEventListener('input', (e) => {
        this.canvas.backgroundColor = e.target.value;
        this.canvas.renderAll();
        this.history.saveState();
      });
    }
  }

  setupManagers() {
    this.history = new HistoryManager(this);
    this.tools = new ToolsManager(this);
    this.properties = new PropertiesManager(this);
    this.filterManager = new FilterManager(this);
    this.cropManager = new CropManager(this);
    this.io = new IOManager(this);
  }

  setupZoomControls() {
    const zoomLevel = document.getElementById('zoom-level');

    // 鼠标滚轮缩放
    this.canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let newZoom = this.zoom * (delta > 0 ? 0.9 : 1.1);
      newZoom = Math.min(Math.max(0.1, newZoom), 5);

      this.setZoom(newZoom, opt.e.offsetX, opt.e.offsetY);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // 缩放按钮
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
      this.setZoom(this.zoom * 1.2);
    });

    document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
      this.setZoom(this.zoom / 1.2);
    });

    document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
      this.setZoom(1);
      this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    });

    document.getElementById('zoom-fit-btn')?.addEventListener('click', () => {
      this.fitToScreen();
    });
  }

  setZoom(newZoom, centerX, centerY) {
    newZoom = Math.min(Math.max(0.1, newZoom), 5);

    if (centerX !== undefined && centerY !== undefined) {
      const point = new fabric.Point(centerX, centerY);
      this.canvas.zoomToPoint(point, newZoom);
    } else {
      const center = this.canvas.getCenter();
      const point = new fabric.Point(center.left, center.top);
      this.canvas.zoomToPoint(point, newZoom);
    }

    this.zoom = newZoom;
    this.updateZoomDisplay();
  }

  fitToScreen() {
    const container = document.getElementById('canvas-wrapper');
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;

    const scaleX = containerWidth / this.canvasWidth;
    const scaleY = containerHeight / this.canvasHeight;
    const newZoom = Math.min(scaleX, scaleY, 1);

    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.setZoom(newZoom);
  }

  updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  setupCanvasSizeControls() {
    const widthInput = document.getElementById('canvas-width');
    const heightInput = document.getElementById('canvas-height');
    const applyBtn = document.getElementById('apply-size-btn');

    if (widthInput) widthInput.value = this.canvasWidth;
    if (heightInput) heightInput.value = this.canvasHeight;

    applyBtn?.addEventListener('click', () => {
      const newWidth = parseInt(widthInput?.value) || 1200;
      const newHeight = parseInt(heightInput?.value) || 800;
      this.resizeCanvas(newWidth, newHeight);
    });
  }

  resizeCanvas(width, height) {
    this.canvasWidth = Math.max(100, Math.min(4000, width));
    this.canvasHeight = Math.max(100, Math.min(4000, height));

    this.canvas.setDimensions({
      width: this.canvasWidth,
      height: this.canvasHeight
    });

    const wrapper = document.getElementById('canvas-workspace');
    wrapper.style.width = `${this.canvasWidth}px`;
    wrapper.style.height = `${this.canvasHeight}px`;

    this.canvas.renderAll();
    this.history.saveState();
    this.showToast(`画布尺寸已调整为 ${this.canvasWidth} × ${this.canvasHeight}`, 'success');
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // 如果正在编辑文本，不处理快捷键
      const activeObject = this.canvas.getActiveObject();
      if (activeObject && activeObject.isEditing) return;

      // Ctrl/Cmd + Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.history.undo();
      }

      // Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z: 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.history.redo();
      }

      // Ctrl/Cmd + S: 保存项目
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.io.saveAsJSON();
      }

      // Delete/Backspace: 删除选中对象
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
        e.preventDefault();
        this.properties.deleteSelected();
      }

      // Ctrl/Cmd + A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }

      // Ctrl/Cmd + C: 复制
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copy();
      }

      // Ctrl/Cmd + V: 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // 粘贴由IOManager处理图片粘贴
        if (!this.clipboard) return;
        e.preventDefault();
        this.paste();
      }

      // Ctrl/Cmd + D: 复制对象
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicate();
      }

      // 工具快捷键
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            this.tools.setTool('select');
            break;
          case 'h':
            this.tools.setTool('hand');
            break;
          case 'p':
            this.tools.setTool('pencil');
            break;
          case 'e':
            this.tools.setTool('eraser');
            break;
          case 'r':
            this.tools.setTool('rect');
            break;
          case 'c':
            this.tools.setTool('circle');
            break;
          case 't':
            this.tools.setTool('triangle');
            break;
          case 'l':
            this.tools.setTool('line');
            break;
          case 'a':
            this.tools.setTool('arrow');
            break;
          case 'x':
            this.tools.setTool('text');
            break;
          case 'i':
            this.tools.setTool('image');
            break;
          case 'k':
            this.tools.setTool('crop');
            break;
          case ' ':
            // 空格键临时切换到抓手工具
            if (this.tools.currentTool !== 'hand') {
              this.previousTool = this.tools.currentTool;
              this.tools.setTool('hand');
            }
            break;
        }
      }
    });

    // 空格键释放时恢复之前的工具
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.previousTool) {
        this.tools.setTool(this.previousTool);
        this.previousTool = null;
      }
    });
  }

  setupCanvasEvents() {
    // 画布平移
    this.canvas.on('mouse:down', (opt) => {
      if (this.tools.currentTool === 'hand') {
        this.isPanning = true;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
        this.canvas.defaultCursor = 'grabbing';
      }
    });

    this.canvas.on('mouse:move', (opt) => {
      if (this.isPanning && this.tools.currentTool === 'hand') {
        const deltaX = opt.e.clientX - this.lastPosX;
        const deltaY = opt.e.clientY - this.lastPosY;

        const vpt = this.canvas.viewportTransform;
        vpt[4] += deltaX;
        vpt[5] += deltaY;

        this.canvas.requestRenderAll();
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
      }
    });

    this.canvas.on('mouse:up', () => {
      this.isPanning = false;
      if (this.tools.currentTool === 'hand') {
        this.canvas.defaultCursor = 'grab';
      }
    });

    // 对象修改事件
    this.canvas.on('object:modified', () => {
      this.history.saveState();
    });

    this.canvas.on('object:added', () => {
      // 路径绘制完成后保存状态
      if (this.canvas.isDrawingMode) {
        this.history.saveState();
      }
    });

    this.canvas.on('object:removed', () => {
      // 由其他地方手动调用saveState
    });

    // 路径创建完成
    this.canvas.on('path:created', () => {
      this.history.saveState();
    });
  }

  customizeControls() {
    // 自定义控制点样式 - Figma/Canva 风格
    // Fabric.js v6 使用 ownDefaults 设置默认属性
    const defaultControlStyle = {
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      cornerSize: 10,
      cornerStyle: 'circle',
      transparentCorners: false,
      borderColor: '#4f46e5',
      borderScaleFactor: 2,
      padding: 0,
      borderDashArray: null
    };

    // 应用默认样式到所有对象类型
    Object.assign(fabric.Object.prototype, defaultControlStyle);

    // 自定义旋转控制点样式 - Fabric.js v6 兼容
    if (fabric.Object.prototype.controls && fabric.Object.prototype.controls.mtr) {
      const mtrControl = fabric.Object.prototype.controls.mtr;
      mtrControl.offsetY = -30;
      mtrControl.cursorStyle = 'crosshair';
      mtrControl.render = (ctx, left, top, styleOverride, fabricObject) => {
        const size = 10;
        ctx.save();
        ctx.translate(left, top);
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      };
    }
  }

  selectAll() {
    const objects = this.canvas.getObjects().filter(obj => obj.selectable !== false);
    if (objects.length === 0) return;

    const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(selection);
    this.canvas.renderAll();
  }

  clipboard = null;

  copy() {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    activeObject.clone().then((cloned) => {
      this.clipboard = cloned;
    });
  }

  paste() {
    if (!this.clipboard) return;

    this.clipboard.clone().then((clonedObj) => {
      this.canvas.discardActiveObject();

      clonedObj.set({
        left: clonedObj.left + 20,
        top: clonedObj.top + 20,
        evented: true
      });

      if (clonedObj.type === 'activeselection') {
        clonedObj.canvas = this.canvas;
        clonedObj.forEachObject((obj) => {
          this.canvas.add(obj);
        });
        clonedObj.setCoords();
      } else {
        this.canvas.add(clonedObj);
      }

      // 更新剪贴板位置
      this.clipboard.set({
        left: this.clipboard.left + 20,
        top: this.clipboard.top + 20
      });

      this.canvas.setActiveObject(clonedObj);
      this.canvas.renderAll();
      this.history.saveState();
    });
  }

  duplicate() {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    activeObject.clone().then((clonedObj) => {
      this.canvas.discardActiveObject();

      clonedObj.set({
        left: clonedObj.left + 20,
        top: clonedObj.top + 20,
        evented: true
      });

      if (clonedObj.type === 'activeselection') {
        clonedObj.canvas = this.canvas;
        clonedObj.forEachObject((obj) => {
          this.canvas.add(obj);
        });
        clonedObj.setCoords();
      } else {
        this.canvas.add(clonedObj);
      }

      this.canvas.setActiveObject(clonedObj);
      this.canvas.renderAll();
      this.history.saveState();
    });
  }

  createToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}

// 初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
  window.editor = new FabricEditor();
});
