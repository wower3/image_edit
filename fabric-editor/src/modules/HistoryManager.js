/**
 * History Manager - 撤销/重做系统（优化版）
 */
export class HistoryManager {
  constructor(editor, maxStates = 50) {
    this.editor = editor;
    this.maxStates = maxStates;
    this.undoStack = [];
    this.redoStack = [];
    this.isRestoring = false;
    this.isSaving = false;

    // 防抖定时器
    this.debounceTimer = null;
    this.debounceDelay = 300; // 300ms 防抖延迟

    // 绑定按钮事件
    this.setupEventListeners();
  }

  /**
   * 绑定撤销/重做按钮事件
   */
  setupEventListeners() {
    document.getElementById('undo-btn')?.addEventListener('click', () => {
      this.undo();
    });

    document.getElementById('redo-btn')?.addEventListener('click', () => {
      this.redo();
    });
  }

  /**
   * 保存当前状态（带防抖）
   */
  saveState() {
    if (this.isRestoring || this.isSaving) return;

    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的防抖定时器
    this.debounceTimer = setTimeout(() => {
      this._doSaveState();
    }, this.debounceDelay);
  }

  /**
   * 立即保存状态（不防抖，用于关键操作）
   */
  saveStateImmediate() {
    if (this.isRestoring || this.isSaving) return;

    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this._doSaveState();
  }

  /**
   * 实际执行保存状态
   */
  _doSaveState() {
    if (this.isRestoring || this.isSaving) return;

    this.isSaving = true;

    try {
      const state = this.editor.canvas.toJSON([
        'id', 'selectable', 'evented', 'name',
        'filters', 'crossOrigin', 'src', '_isPlaceholder',
        '_shapeType', '_bubbleWidth', '_bubbleHeight', '_tailSize'
      ]);

      const stateStr = JSON.stringify(state);

      // 避免保存重复状态
      if (this.undoStack.length > 0 &&
          this.undoStack[this.undoStack.length - 1] === stateStr) {
        this.isSaving = false;
        return;
      }

      this.undoStack.push(stateStr);
      this.redoStack = []; // 清空重做栈

      // 限制最大状态数
      if (this.undoStack.length > this.maxStates) {
        this.undoStack.shift();
      }

      this.updateButtons();
    } catch (error) {
      console.error('保存状态失败:', error);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 撤销操作
   */
  undo() {
    if (this.undoStack.length <= 1 || this.isRestoring) return;

    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    const previousState = this.undoStack[this.undoStack.length - 1];
    this.restoreState(previousState);
  }

  /**
   * 重做操作
   */
  redo() {
    if (this.redoStack.length === 0 || this.isRestoring) return;

    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);

    this.restoreState(nextState);
  }

  /**
   * 恢复到指定状态
   */
  restoreState(stateJson) {
    this.isRestoring = true;

    const canvas = this.editor.canvas;

    // 先取消所有选择
    canvas.discardActiveObject();

    try {
      const state = JSON.parse(stateJson);

      canvas.loadFromJSON(state).then(() => {
        canvas.renderAll();
        this.isRestoring = false;
        this.updateButtons();

        // 确保所有对象可选，并为文本框绑定事件
        canvas.forEachObject(obj => {
          if (obj.name !== 'cropRect') {
            obj.selectable = true;
            obj.evented = true;
          }
          // 为文本框绑定PPT风格事件（排除气泡文本）
          if (obj.type === 'textbox' && obj._shapeType !== 'bubbleText') {
            this.setupRestoredTextBox(obj);
          }
        });

        // 恢复气泡和文本的绑定关系
        this.restoreBubbleTextBindings();
      }).catch(error => {
        console.error('恢复状态失败:', error);
        this.isRestoring = false;
      });
    } catch (error) {
      console.error('解析状态失败:', error);
      this.isRestoring = false;
    }
  }

  /**
   * 恢复气泡和文本的绑定关系
   */
  restoreBubbleTextBindings() {
    const canvas = this.editor.canvas;
    const bindableShapes = [];  // 包括 bubble, rect, circle, triangle
    const shapeTexts = [];      // 包括 bubbleText, shapeText

    // 找出所有可绑定形状和形状文本
    canvas.forEachObject(obj => {
      if (['bubble', 'rect', 'circle', 'triangle'].includes(obj._shapeType)) {
        bindableShapes.push(obj);
      } else if (['bubbleText', 'shapeText'].includes(obj._shapeType)) {
        shapeTexts.push(obj);
      }
    });

    // 为每个形状找到最近的文本并绑定
    bindableShapes.forEach(shape => {
      const shapeCenter = shape.getCenterPoint();
      let closestText = null;
      let minDistance = Infinity;

      shapeTexts.forEach(text => {
        if (text._boundBubble || text._boundShape) return; // 已绑定的跳过
        const textCenter = text.getCenterPoint();
        const distance = Math.sqrt(
          Math.pow(shapeCenter.x - textCenter.x, 2) +
          Math.pow(shapeCenter.y - textCenter.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestText = text;
        }
      });

      if (closestText) {
        // 设置文本属性
        closestText.set({
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true
        });

        if (shape._shapeType === 'bubble') {
          // 气泡绑定
          shape._boundText = closestText;
          closestText._boundBubble = shape;
          this.editor.tools.bindBubbleTextEvents(shape, closestText);
          this.editor.tools.setupBubbleTextEvents(closestText);
        } else {
          // 形状绑定（rect, circle, triangle）
          shape._boundText = closestText;
          closestText._boundShape = shape;
          this.editor.tools.bindShapeTextEvents(shape, closestText);
          this.editor.tools.setupShapeTextEvents(closestText);
        }
      }
    });
  }

  /**
   * 为恢复的文本框设置PPT风格事件
   */
  setupRestoredTextBox(textbox) {
    const canvas = this.editor.canvas;
    const editor = this.editor;

    // 初始化时隐藏边框（除非被选中）
    if (canvas.getActiveObject() !== textbox) {
      textbox.set({
        stroke: 'transparent',
        strokeWidth: 0
      });
    }

    // 进入编辑模式时
    textbox.on('editing:entered', () => {
      if (textbox._isPlaceholder) {
        textbox.set({
          text: '',
          fill: '#000000',
          fontStyle: 'normal',
          _isPlaceholder: false
        });
        canvas.renderAll();
      }
      textbox.set({
        stroke: '#4f46e5',
        strokeWidth: 1
      });
      canvas.renderAll();
    });

    // 退出编辑模式时
    textbox.on('editing:exited', () => {
      if (!textbox.text || textbox.text.trim() === '') {
        textbox.set({
          text: '点击输入文本',
          fill: '#999999',
          fontStyle: 'italic',
          _isPlaceholder: true
        });
      }
      if (canvas.getActiveObject() !== textbox) {
        textbox.set({
          stroke: 'transparent',
          strokeWidth: 0
        });
      }
      canvas.renderAll();
    });

    // 选中时显示边框
    textbox.on('selected', () => {
      textbox.set({
        stroke: '#4f46e5',
        strokeWidth: 1
      });
      canvas.renderAll();
    });

    // 取消选中时隐藏边框
    textbox.on('deselected', () => {
      textbox.set({
        stroke: 'transparent',
        strokeWidth: 0
      });
      canvas.renderAll();
    });
  }

  /**
   * 更新撤销/重做按钮状态
   */
  updateButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length <= 1;
      undoBtn.title = `撤销 (Ctrl+Z) [${this.undoStack.length - 1}]`;
    }
    if (redoBtn) {
      redoBtn.disabled = this.redoStack.length === 0;
      redoBtn.title = `重做 (Ctrl+Y) [${this.redoStack.length}]`;
    }
  }

  /**
   * 清空历史记录
   */
  clear() {
    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.undoStack = [];
    this.redoStack = [];
    this.saveStateImmediate();
  }

  /**
   * 获取当前历史状态信息
   */
  getInfo() {
    return {
      undoCount: this.undoStack.length - 1,
      redoCount: this.redoStack.length,
      canUndo: this.undoStack.length > 1,
      canRedo: this.redoStack.length > 0
    };
  }
}
