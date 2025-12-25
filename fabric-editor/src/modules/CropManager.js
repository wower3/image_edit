import * as fabric from 'fabric';

/**
 * Crop Manager - 图片裁剪管理（优化版）
 */
export class CropManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;
    this.cropRect = null;
    this.targetImage = null;
    this.isCropping = false;
    this.overlay = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('apply-crop')?.addEventListener('click', () => {
      this.applyCrop();
    });

    document.getElementById('cancel-crop')?.addEventListener('click', () => {
      this.cancelCrop();
    });
  }

  /**
   * 检查对象是否为图片类型
   */
  isImageObject(obj) {
    if (!obj) return false;
    // Fabric.js v6 中图片类型可能是 'image' 或检查构造函数
    return obj.type === 'image' ||
           obj.constructor.name === 'FabricImage' ||
           obj.constructor.name === 'Image' ||
           (obj.getElement && obj.getElement() instanceof HTMLImageElement);
  }

  /**
   * 启用裁剪模式
   */
  enableCropMode() {
    const activeObject = this.canvas.getActiveObject();

    // 检查是否选中了图片
    if (!activeObject || !this.isImageObject(activeObject)) {
      this.editor.showToast('请先选择一张图片再进行裁剪', 'error');
      this.editor.tools.setTool('select');
      return;
    }

    this.targetImage = activeObject;
    this.isCropping = true;

    // 保存图片的原始状态
    this.originalImageState = {
      left: this.targetImage.left,
      top: this.targetImage.top,
      scaleX: this.targetImage.scaleX,
      scaleY: this.targetImage.scaleY,
      angle: this.targetImage.angle
    };

    // 禁用图片的交互
    this.targetImage.selectable = false;
    this.targetImage.evented = false;
    this.targetImage.hasControls = false;

    // 获取图片的边界（考虑缩放和旋转）
    const imgBounds = this.targetImage.getBoundingRect();

    // 创建暗色遮罩层
    this.createOverlay(imgBounds);

    // 创建裁剪框（初始大小和位置与图片完全一致）
    this.cropRect = new fabric.Rect({
      left: imgBounds.left,
      top: imgBounds.top,
      width: imgBounds.width,
      height: imgBounds.height,
      fill: 'transparent',
      stroke: '#4f46e5',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      cornerColor: '#4f46e5',
      cornerStrokeColor: '#ffffff',
      cornerSize: 12,
      cornerStyle: 'circle',
      transparentCorners: false,
      hasRotatingPoint: false,
      lockRotation: true,
      name: 'cropRect',
      // 限制裁剪框移动范围
      lockMovementX: false,
      lockMovementY: false
    });

    // 添加裁剪框移动限制
    this.cropRect.on('moving', () => this.constrainCropRect());
    this.cropRect.on('scaling', () => this.constrainCropRect());

    this.canvas.add(this.cropRect);
    this.canvas.setActiveObject(this.cropRect);
    this.canvas.renderAll();

    this.editor.showToast('调整裁剪框大小和位置，然后点击"应用裁剪"', 'info');
  }

  /**
   * 创建遮罩层
   */
  createOverlay(imgBounds) {
    // 创建半透明遮罩，突出显示裁剪区域
    this.overlay = new fabric.Rect({
      left: imgBounds.left - 2000,
      top: imgBounds.top - 2000,
      width: imgBounds.width + 4000,
      height: imgBounds.height + 4000,
      fill: 'rgba(0, 0, 0, 0.5)',
      selectable: false,
      evented: false,
      name: 'cropOverlay'
    });
    this.canvas.add(this.overlay);
  }

  /**
   * 限制裁剪框在图片范围内
   */
  constrainCropRect() {
    if (!this.cropRect || !this.targetImage) return;

    const imgBounds = this.targetImage.getBoundingRect();
    const cropBounds = this.cropRect.getBoundingRect();

    let left = this.cropRect.left;
    let top = this.cropRect.top;

    // 限制左边界
    if (cropBounds.left < imgBounds.left) {
      left = imgBounds.left;
    }
    // 限制右边界
    if (cropBounds.left + cropBounds.width > imgBounds.left + imgBounds.width) {
      left = imgBounds.left + imgBounds.width - cropBounds.width;
    }
    // 限制上边界
    if (cropBounds.top < imgBounds.top) {
      top = imgBounds.top;
    }
    // 限制下边界
    if (cropBounds.top + cropBounds.height > imgBounds.top + imgBounds.height) {
      top = imgBounds.top + imgBounds.height - cropBounds.height;
    }

    this.cropRect.set({ left, top });
    this.cropRect.setCoords();
  }

  /**
   * 应用裁剪
   */
  applyCrop() {
    if (!this.cropRect || !this.targetImage) {
      this.editor.showToast('没有可裁剪的内容', 'error');
      return;
    }

    try {
      const cropBounds = this.cropRect.getBoundingRect();
      const imgBounds = this.targetImage.getBoundingRect();

      // 获取图片的缩放比例
      const scaleX = this.targetImage.scaleX || 1;
      const scaleY = this.targetImage.scaleY || 1;

      // 计算裁剪区域相对于原始图片的位置（像素坐标）
      const cropLeft = Math.max(0, (cropBounds.left - imgBounds.left) / scaleX);
      const cropTop = Math.max(0, (cropBounds.top - imgBounds.top) / scaleY);
      const cropWidth = Math.min(cropBounds.width / scaleX, this.targetImage.width - cropLeft);
      const cropHeight = Math.min(cropBounds.height / scaleY, this.targetImage.height - cropTop);

      // 确保裁剪区域有效
      if (cropWidth <= 0 || cropHeight <= 0) {
        this.editor.showToast('裁剪区域无效', 'error');
        return;
      }

      // 获取图片元素
      const imgElement = this.targetImage.getElement();

      // 创建临时 canvas 进行裁剪
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.round(cropWidth);
      tempCanvas.height = Math.round(cropHeight);
      const ctx = tempCanvas.getContext('2d');

      // 绘制裁剪区域
      ctx.drawImage(
        imgElement,
        Math.round(cropLeft),
        Math.round(cropTop),
        Math.round(cropWidth),
        Math.round(cropHeight),
        0,
        0,
        Math.round(cropWidth),
        Math.round(cropHeight)
      );

      // 创建新图片
      const dataURL = tempCanvas.toDataURL('image/png');

      fabric.FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' }).then((newImg) => {
        newImg.set({
          left: cropBounds.left,
          top: cropBounds.top,
          scaleX: scaleX,
          scaleY: scaleY,
          selectable: true,
          evented: true
        });

        // 移除遮罩层
        if (this.overlay) {
          this.canvas.remove(this.overlay);
        }

        // 移除原图片和裁剪框
        this.canvas.remove(this.targetImage);
        this.canvas.remove(this.cropRect);

        // 添加新图片
        this.canvas.add(newImg);
        this.canvas.setActiveObject(newImg);
        this.canvas.renderAll();

        // 保存历史状态
        this.editor.history.saveStateImmediate();
        this.editor.showToast('裁剪成功', 'success');

        this.cleanup();
        this.editor.tools.setTool('select');
      }).catch(error => {
        console.error('创建裁剪图片失败:', error);
        this.editor.showToast('裁剪失败，请重试', 'error');
        this.cancelCrop();
      });
    } catch (error) {
      console.error('裁剪过程出错:', error);
      this.editor.showToast('裁剪失败: ' + error.message, 'error');
      this.cancelCrop();
    }
  }

  /**
   * 取消裁剪
   */
  cancelCrop() {
    // 移除遮罩层
    if (this.overlay) {
      this.canvas.remove(this.overlay);
    }

    // 移除裁剪框
    if (this.cropRect) {
      this.canvas.remove(this.cropRect);
    }

    // 恢复图片状态
    if (this.targetImage) {
      this.targetImage.selectable = true;
      this.targetImage.evented = true;
      this.targetImage.hasControls = true;

      // 恢复原始位置和状态
      if (this.originalImageState) {
        this.targetImage.set(this.originalImageState);
      }

      this.canvas.setActiveObject(this.targetImage);
    }

    this.cleanup();
    this.editor.tools.setTool('select');
    this.canvas.renderAll();

    this.editor.showToast('已取消裁剪', 'info');
  }

  /**
   * 清理状态
   */
  cleanup() {
    this.cropRect = null;
    this.targetImage = null;
    this.overlay = null;
    this.originalImageState = null;
    this.isCropping = false;
    document.getElementById('crop-panel')?.classList.add('hidden');
  }

  /**
   * 检查是否正在裁剪模式
   */
  isInCropMode() {
    return this.isCropping;
  }
}
