import React, { useCallback, useEffect, useRef } from "react";

const DEFAULT_TEXT = "SMART EYE DETECTION SYSTEM";
const DEFAULT_FONT_FAMILY = "'Roboto Mono', monospace";

interface PhysicsParams {
  PARTICLE_COUNT_TARGET: number;
  PARTICLE_BASE_SIZE: number;
  ATTRACTION_FORCE_BASE: number;
  NOISE_STRENGTH_BASE: number;
  FRICTION: number;
  MOUSE_INTERACTION_RADIUS: number;
  MOUSE_DISPERSE_STRENGTH: number;
  TRAIL_ALPHA: number;
}

const initialPhysicsParams: PhysicsParams = {
  PARTICLE_COUNT_TARGET: 4000,
  PARTICLE_BASE_SIZE: 1.8,
  ATTRACTION_FORCE_BASE: 0.22,
  NOISE_STRENGTH_BASE: 0.05,
  FRICTION: 0.88,
  MOUSE_INTERACTION_RADIUS: 90,
  MOUSE_DISPERSE_STRENGTH: 1.2,
  TRAIL_ALPHA: 0.22,
};

const POINT_SAMPLING_DENSITY = 2;
const TARGET_CANVAS_WIDTH_FILL_PERCENTAGE = 0.92;
const TARGET_CANVAS_HEIGHT_FILL_PERCENTAGE = 0.72;
const MAX_INITIAL_FONT_SIZE = 350;
const MIN_FONT_SIZE = 12;
const FIT_CHECK_PADDING = 25;
const SETTLE_DISTANCE_THRESHOLD = 4;
const SETTLE_ATTRACTION_MULTIPLIER = 0.15;
const SETTLE_NOISE_MULTIPLIER = 0.7;

const thermalPalettes = {
  neutral: ["#ffffff", "#f8fafc", "#eef6ff", "#dbeafe"],
};
const PARTICLE_COLORS = [...thermalPalettes.neutral];

interface MousePosition {
  x: number | undefined;
  y: number | undefined;
}

interface WordPoint {
  x?: number;
  y?: number;
  sourceCanvasWidth: number;
  sourceCanvasHeight: number;
  isEmptyPlaceholder?: boolean;
}

interface ParticleTypographyProps {
  text?: string;
  className?: string;
  height?: number;
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  physicsParams: PhysicsParams;
  baseSize: number;
  size: number;
  color: string;
  attractionOffset: number;
  noiseOffset: number;

  constructor(targetX: number, targetY: number, canvasWidth: number, canvasHeight: number, physicsParams: PhysicsParams) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.targetX = targetX;
    this.targetY = targetY;
    this.physicsParams = physicsParams;
    this.baseSize = this.physicsParams.PARTICLE_BASE_SIZE;
    this.size = this.baseSize + Math.random() * (this.baseSize * 0.5);
    this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    this.attractionOffset = (Math.random() - 0.5) * 0.04;
    this.noiseOffset = (Math.random() - 0.5) * 0.2;
  }

  update(mouse: MousePosition) {
    if (this.baseSize !== this.physicsParams.PARTICLE_BASE_SIZE) {
      this.baseSize = this.physicsParams.PARTICLE_BASE_SIZE;
      this.size = this.baseSize + Math.random() * (this.baseSize * 0.25);
    }

    const dxTarget = this.targetX - this.x;
    const dyTarget = this.targetY - this.y;
    const distTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);

    let currentAttraction = Math.max(0.001, this.physicsParams.ATTRACTION_FORCE_BASE + this.attractionOffset);
    let currentNoise = Math.max(0, this.physicsParams.NOISE_STRENGTH_BASE + this.noiseOffset);

    if (distTarget < SETTLE_DISTANCE_THRESHOLD) {
      currentAttraction *= SETTLE_ATTRACTION_MULTIPLIER;
      currentNoise *= SETTLE_NOISE_MULTIPLIER;
    } else if (distTarget < SETTLE_DISTANCE_THRESHOLD * 4) {
      const factor = Math.max(0, (distTarget - SETTLE_DISTANCE_THRESHOLD) / (SETTLE_DISTANCE_THRESHOLD * 3));
      currentAttraction = currentAttraction * (SETTLE_ATTRACTION_MULTIPLIER + (1 - SETTLE_ATTRACTION_MULTIPLIER) * factor);
      currentNoise = currentNoise * (SETTLE_NOISE_MULTIPLIER + (1 - SETTLE_NOISE_MULTIPLIER) * factor);
    }

    let forceX = 0;
    let forceY = 0;

    if (mouse.x !== undefined && mouse.y !== undefined) {
      const dxMouse = this.x - mouse.x;
      const dyMouse = this.y - mouse.y;
      const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

      if (distMouse < this.physicsParams.MOUSE_INTERACTION_RADIUS && distMouse > 0) {
        const angleMouse = Math.atan2(dyMouse, dxMouse);
        const disperseForce =
          ((this.physicsParams.MOUSE_INTERACTION_RADIUS - distMouse) / this.physicsParams.MOUSE_INTERACTION_RADIUS) *
          this.physicsParams.MOUSE_DISPERSE_STRENGTH;
        forceX += Math.cos(angleMouse) * disperseForce;
        forceY += Math.sin(angleMouse) * disperseForce;
        currentAttraction *= 0.1;
      }
    }

    if (distTarget > 0.01) {
      forceX += (dxTarget / distTarget) * currentAttraction * Math.min(distTarget, 100) * 0.1;
      forceY += (dyTarget / distTarget) * currentAttraction * Math.min(distTarget, 100) * 0.1;
    }

    forceX += (Math.random() - 0.5) * currentNoise;
    forceY += (Math.random() - 0.5) * currentNoise;

    this.vx += forceX;
    this.vy += forceY;
    this.vx *= this.physicsParams.FRICTION;
    this.vy *= this.physicsParams.FRICTION;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.2, this.size), 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = Math.min(8, this.size * 2);
    ctx.fill();
  }
}

const ParticleTypography = ({ text = DEFAULT_TEXT, className, height = 210 }: ParticleTypographyProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesArrayRef = useRef<Particle[]>([]);
  const wordTargetPointsRef = useRef<WordPoint[]>([]);
  const mouseRef = useRef<MousePosition>({ x: undefined, y: undefined });
  const animationFrameIdRef = useRef<number | null>(null);
  const physicsParamsRef = useRef<PhysicsParams>({ ...initialPhysicsParams });
  const initialParticleCountCalculatedRef = useRef(false);
  const renderFontSizeRef = useRef<number>(MIN_FONT_SIZE);

  const getWordPoints = useCallback((word: string, mainCanvasWidth: number, mainCanvasHeight: number): WordPoint[] => {
    const points: WordPoint[] = [];
    if (!word || word.trim() === "" || mainCanvasWidth <= 0 || mainCanvasHeight <= 0) {
      return [{ sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight, isEmptyPlaceholder: true }];
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = mainCanvasWidth;
    tempCanvas.height = mainCanvasHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      return [{ sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight, isEmptyPlaceholder: true }];
    }

    const normalizedWord = word.toUpperCase();
    const fontToUse = DEFAULT_FONT_FAMILY;
    let optimalFontSize = MIN_FONT_SIZE;
    const maxFontSize = Math.min(MAX_INITIAL_FONT_SIZE, Math.floor(mainCanvasHeight * 0.95));

    for (let fs = maxFontSize; fs >= MIN_FONT_SIZE; fs -= 2) {
      tempCtx.font = `bold ${fs}px ${fontToUse}`;
      const textMetrics = tempCtx.measureText(normalizedWord);
      const textWidthWithPadding = textMetrics.width + FIT_CHECK_PADDING;
      const textHeightWithPadding =
        (textMetrics.actualBoundingBoxAscent || fs * 0.75) + (textMetrics.actualBoundingBoxDescent || fs * 0.25) + FIT_CHECK_PADDING;

      if (
        textWidthWithPadding < mainCanvasWidth * TARGET_CANVAS_WIDTH_FILL_PERCENTAGE &&
        textHeightWithPadding < mainCanvasHeight * TARGET_CANVAS_HEIGHT_FILL_PERCENTAGE
      ) {
        optimalFontSize = fs;
        break;
      }
    }

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.font = `bold ${optimalFontSize}px ${fontToUse}`;
    renderFontSizeRef.current = optimalFontSize;
    tempCtx.fillStyle = "white";
    tempCtx.textAlign = "center";
    tempCtx.textBaseline = "middle";
    tempCtx.fillText(normalizedWord, tempCanvas.width / 2, tempCanvas.height / 2);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    for (let y = 0; y < tempCanvas.height; y += POINT_SAMPLING_DENSITY) {
      for (let x = 0; x < tempCanvas.width; x += POINT_SAMPLING_DENSITY) {
        const alphaIndex = (y * tempCanvas.width + x) * 4 + 3;
        if (data[alphaIndex] > 128) {
          points.push({ x, y, sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight });
        }
      }
    }

    if (points.length === 0) {
      return [{ sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight, isEmptyPlaceholder: true }];
    }
    return points;
  }, []);

  const initParticles = useCallback(
    (forceRepopulateParticles = true, forceRecalculatePoints = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentWord = text.toUpperCase();
      const points = wordTargetPointsRef.current;
      const sourcePoint = points[0];
      const sourceSizeMismatch =
        sourcePoint && (sourcePoint.sourceCanvasWidth !== canvas.width || sourcePoint.sourceCanvasHeight !== canvas.height);

      if (forceRecalculatePoints || points.length === 0 || sourceSizeMismatch) {
        wordTargetPointsRef.current = getWordPoints(currentWord, canvas.width, canvas.height);

        const currentTargets = wordTargetPointsRef.current;
        if (!initialParticleCountCalculatedRef.current && currentTargets.length > 0 && !currentTargets[0].isEmptyPlaceholder) {
          const particleCountStep = 100;
          const particleCountMin = 500;
          const particleCountMax = 10000;
          const particlesPerTargetPointRatio = 1.0;

          let dynamicParticleCount = currentTargets.length * particlesPerTargetPointRatio;
          dynamicParticleCount =
            Math.round(Math.max(particleCountMin, Math.min(particleCountMax, dynamicParticleCount)) / particleCountStep) * particleCountStep;

          physicsParamsRef.current.PARTICLE_COUNT_TARGET = dynamicParticleCount;
          initialParticleCountCalculatedRef.current = true;
        } else if (!initialParticleCountCalculatedRef.current) {
          initialParticleCountCalculatedRef.current = true;
        }
      }

      const targetCount = physicsParamsRef.current.PARTICLE_COUNT_TARGET;
      if (forceRepopulateParticles || particlesArrayRef.current.length !== targetCount) {
        particlesArrayRef.current = [];

        const currentTargets = wordTargetPointsRef.current;
        const noTargets = currentTargets.length === 0 || currentTargets[0].isEmptyPlaceholder;

        for (let i = 0; i < targetCount; i++) {
          if (noTargets) {
            particlesArrayRef.current.push(
              new Particle(Math.random() * canvas.width, Math.random() * canvas.height, canvas.width, canvas.height, physicsParamsRef.current),
            );
          } else {
            const targetPoint = currentTargets[i % currentTargets.length];
            particlesArrayRef.current.push(
              new Particle(targetPoint.x ?? canvas.width / 2, targetPoint.y ?? canvas.height / 2, canvas.width, canvas.height, physicsParamsRef.current),
            );
          }
        }
      } else {
        particlesArrayRef.current.forEach((particle, i) => {
          const currentTargets = wordTargetPointsRef.current;
          if (currentTargets.length > 0 && !currentTargets[0].isEmptyPlaceholder) {
            const targetPoint = currentTargets[i % currentTargets.length];
            particle.targetX = targetPoint.x ?? canvas.width / 2;
            particle.targetY = targetPoint.y ?? canvas.height / 2;
          } else {
            particle.targetX = Math.random() * canvas.width;
            particle.targetY = Math.random() * canvas.height;
          }
          particle.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
          particle.baseSize = physicsParamsRef.current.PARTICLE_BASE_SIZE;
        });
      }
    },
    [getWordPoints, text],
  );

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Keep the layer transparent so no dark box appears behind the text effect.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Draw a subtle guide layer so the phrase remains readable while particles animate.
    const normalizedText = text.toUpperCase();
    ctx.save();
    ctx.font = `800 ${renderFontSizeRef.current}px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = Math.max(1, renderFontSizeRef.current * 0.02);
    ctx.strokeText(normalizedText, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillText(normalizedText, canvas.width / 2, canvas.height / 2);
    ctx.restore();

    particlesArrayRef.current.forEach((particle) => {
      particle.update(mouseRef.current);
      particle.draw(ctx);
    });

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    animationFrameIdRef.current = requestAnimationFrame(animate);
  }, [text]);

  const adjustLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const newCanvasWidth = Math.max(1, Math.floor(container.clientWidth));
    const newCanvasHeight = Math.max(1, Math.floor(container.clientHeight));

    if (canvas.width !== newCanvasWidth || canvas.height !== newCanvasHeight) {
      canvas.width = newCanvasWidth;
      canvas.height = newCanvasHeight;
      initParticles(false, true);
    }
  }, [initParticles]);

  useEffect(() => {
    const fontInter = new FontFace("Inter", "url(https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2)");
    const fontRobotoMono = new FontFace("Roboto Mono", "url(https://fonts.gstatic.com/s/robotomono/v22/L0x5DF4xlVMF-BfR8bXMIjhGq3-cXbKDO1k.woff2)");

    const fontLoadingPromise = Promise.all([fontInter.load(), fontRobotoMono.load()])
      .then((loadedFonts) => {
        loadedFonts.forEach((font) => document.fonts.add(font));
        return document.fonts.ready;
      })
      .catch(() => Promise.resolve());

    fontLoadingPromise.finally(() => {
      adjustLayout();
      initParticles(true, true);
      if (!animationFrameIdRef.current) {
        animate();
      }
    });

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        mouseRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: undefined, y: undefined };
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && event.touches.length > 0) {
        mouseRef.current = { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current = { x: undefined, y: undefined };
    };

    const canvasElement = canvasRef.current;
    canvasElement?.addEventListener("mousemove", handleMouseMove);
    canvasElement?.addEventListener("mouseleave", handleMouseLeave);
    canvasElement?.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvasElement?.addEventListener("touchend", handleTouchEnd);
    canvasElement?.addEventListener("touchcancel", handleTouchEnd);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        requestAnimationFrame(() => {
          adjustLayout();
          if (!animationFrameIdRef.current) {
            animate();
          }
        });
      }, 180);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      canvasElement?.removeEventListener("mousemove", handleMouseMove);
      canvasElement?.removeEventListener("mouseleave", handleMouseLeave);
      canvasElement?.removeEventListener("touchmove", handleTouchMove);
      canvasElement?.removeEventListener("touchend", handleTouchEnd);
      canvasElement?.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [adjustLayout, animate, initParticles]);

  return (
    <div ref={containerRef} className={className} style={{ height }}>
      <canvas ref={canvasRef} style={{ display: "block", backgroundColor: "transparent", borderRadius: 0 }} className="h-full w-full" />
    </div>
  );
};

export default ParticleTypography;
