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
        'filters', 'crossOrigin', 'src'
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

        // 确保所有对象可选
        canvas.forEachObject(obj => {
          if (obj.name !== 'cropRect') {
            obj.selectable = true;
            obj.evented = true;
          }
        });
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
