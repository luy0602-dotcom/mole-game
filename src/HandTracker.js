import { useEffect, useRef, useState } from "react";

const INITIAL_CENTER = { x: 0.5, y: 0.72 };
const HAND_SEPARATION = 0.085;
const MEDIAPIPE_SCRIPT = "/mediapipe/hands/hands.js";

function createHands(center, fist = false, hit = false, hitTick = 0) {
  return [
    {
      id: "left",
      x: Math.max(0.05, center.x - HAND_SEPARATION),
      y: center.y,
      fist,
      hit,
      hitTick,
      detected: true,
    },
    {
      id: "right",
      x: Math.min(0.95, center.x + HAND_SEPARATION),
      y: center.y,
      fist,
      hit,
      hitTick,
      detected: true,
    },
  ];
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function isFist(landmarks) {
  const foldedFingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].filter(([tip, joint]) => landmarks[tip].y > landmarks[joint].y + 0.01).length;

  const thumbCurled =
    Math.abs(landmarks[4].x - landmarks[9].x) < 0.18 &&
    landmarks[4].y > landmarks[3].y - 0.03;

  return foldedFingers >= 3 && thumbCurled;
}

function handPosition(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const x = (wrist.x + middleBase.x) / 2;
  const y = (wrist.y + middleBase.y) / 2;

  return {
    x: Math.min(0.92, Math.max(0.08, 1 - x)),
    y: Math.min(0.95, Math.max(0.08, y)),
  };
}

function buildDetectedHands(results, handStateRef) {
  const hands = [];
  const landmarksList = results.multiHandLandmarks || [];
  const labels = results.multiHandedness || [];
  const now = performance.now();

  landmarksList.forEach((landmarks, index) => {
    const handedness = labels[index]?.label?.toLowerCase?.() || (index === 0 ? "left" : "right");
    const id = handedness === "left" ? "left" : "right";
    const position = handPosition(landmarks);
    const fist = isFist(landmarks);
    const last = handStateRef.current[id];
    const deltaX = last?.position ? position.x - last.position.x : 0;
    const deltaY = last?.position ? position.y - last.position.y : 0;
    const motion = Math.hypot(deltaX, deltaY);
    const canTrigger = !last?.lastHitAt || now - last.lastHitAt > 75;
    const hit = fist && motion > 0.018 && canTrigger;
    const hitTick = hit ? (last?.hitTick || 0) + 1 : last?.hitTick || 0;

    handStateRef.current[id] = {
      position,
      lastHitAt: hit ? now : last?.lastHitAt || 0,
      hitTick,
    };

    hands.push({
      id,
      x: position.x,
      y: position.y,
      fist,
      hit,
      hitTick,
      detected: true,
    });
  });

  if (!hands.length) {
    return [];
  }

  return hands.sort((a, b) => (a.id > b.id ? 1 : -1));
}

export function useHandTracker({ enabled }) {
  const videoRef = useRef(null);
  const hitTimeoutRef = useRef(0);
  const pointerRef = useRef(INITIAL_CENTER);
  const fistsActiveRef = useRef(false);
  const handStateRef = useRef({});
  const rafRef = useRef(0);
  const trackerRef = useRef(null);
  const usingVisionRef = useRef(false);
  const [permission, setPermission] = useState("pending");
  const [hands, setHands] = useState(createHands(INITIAL_CENTER));
  useEffect(() => {
    let stream;
    let cancelled = false;

    async function connectCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            facingMode: "user",
          },
          audio: false,
        });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPermission("granted");
      } catch (error) {
        if (!cancelled) {
          setPermission("denied");
        }
      }
    }

    connectCamera();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
      window.clearTimeout(hitTimeoutRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setupVision() {
      if (!enabled || !videoRef.current || permission !== "granted" || trackerRef.current) return;

      try {
        await loadScript(MEDIAPIPE_SCRIPT);
        if (cancelled || !window.Hands) return;

        const handsTracker = new window.Hands({
          locateFile: (file) => `/mediapipe/hands/${file}`,
        });

        handsTracker.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.4,
        });

        handsTracker.onResults((results) => {
          if (cancelled) return;
          const detectedHands = buildDetectedHands(results, handStateRef);
          if (!detectedHands.length) {
            setHands([]);
            return;
          }

          usingVisionRef.current = true;
          setHands(detectedHands);

          if (detectedHands.some((hand) => hand.hit)) {
            window.clearTimeout(hitTimeoutRef.current);
            hitTimeoutRef.current = window.setTimeout(() => {
              setHands((prev) => prev.map((hand) => ({ ...hand, hit: false })));
            }, 110);
          }
        });

        trackerRef.current = handsTracker;

        const loop = async () => {
          if (
            cancelled ||
            !trackerRef.current ||
            !videoRef.current ||
            videoRef.current.readyState < 2
          ) {
            rafRef.current = window.requestAnimationFrame(loop);
            return;
          }

          await trackerRef.current.send({ image: videoRef.current });
          rafRef.current = window.requestAnimationFrame(loop);
        };

        rafRef.current = window.requestAnimationFrame(loop);
      } catch (error) {
        usingVisionRef.current = false;
      }
    }

    setupVision();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, permission]);

  useEffect(() => {
    const updateCenter = (clientX, clientY, fist = false, hit = false, targetHandId = null) => {
      if (usingVisionRef.current) return;
      const nextCenter = {
        x: Math.min(0.88, Math.max(0.12, clientX / window.innerWidth)),
        y: Math.min(0.96, Math.max(0.1, clientY / window.innerHeight)),
      };
      pointerRef.current = nextCenter;
      setHands((prev) =>
        createHands(nextCenter).map((hand) => {
          const previousHand = prev.find((item) => item.id === hand.id);
          const shouldApply = !targetHandId || targetHandId === hand.id;
          const motion = previousHand
            ? Math.hypot(hand.x - previousHand.x, hand.y - previousHand.y)
            : 0;
          const swing = shouldApply ? hit || (fist && motion > 0.012) : false;
          return {
            ...hand,
            fist: shouldApply ? fist : previousHand?.fist || false,
            hit: swing,
            hitTick: swing ? (previousHand?.hitTick || 0) + 1 : previousHand?.hitTick || 0,
            detected: true,
          };
        }),
      );
    };

    const setFists = (fist, hit = false, targetHandId = null) => {
      if (usingVisionRef.current) return;
      fistsActiveRef.current = fist;
      setHands((prev) =>
        createHands(pointerRef.current).map((hand) => {
          const previousHand = prev.find((item) => item.id === hand.id);
          const shouldApply = !targetHandId || targetHandId === hand.id;
          const swing = shouldApply ? hit : false;
          return {
            ...hand,
            fist: shouldApply ? fist : previousHand?.fist || false,
            hit: swing,
            hitTick: swing ? (previousHand?.hitTick || 0) + 1 : previousHand?.hitTick || 0,
            detected: true,
          };
        }),
      );
    };

    const triggerHit = (clientX, clientY, targetHandId = "right") => {
      if (!enabled || usingVisionRef.current) return;
      if (typeof clientX === "number" && typeof clientY === "number") {
        updateCenter(clientX, clientY, true, true, targetHandId);
      } else {
        setFists(true, true, targetHandId);
      }
      window.clearTimeout(hitTimeoutRef.current);
      hitTimeoutRef.current = window.setTimeout(() => {
        setFists(true, false, targetHandId);
      }, 120);
    };

    const handleMove = (event) => updateCenter(event.clientX, event.clientY, fistsActiveRef.current);
    const handleTouchMove = (event) => {
      const touch = event.touches[0];
      if (touch) {
        updateCenter(touch.clientX, touch.clientY, fistsActiveRef.current);
      }
    };
    const handlePointerDown = (event) => {
      triggerHit(event.clientX, event.clientY, event.shiftKey ? "left" : "right");
    };
    const handlePointerUp = () => {
      setFists(false, false);
    };
    const handleKeyDown = (event) => {
      if (event.code === "Space" && !event.repeat) {
        triggerHit(undefined, undefined, "right");
      }
      if (event.code === "KeyF") {
        setFists(true, false, "left");
      }
      if (event.code === "KeyJ") {
        setFists(true, false, "right");
      }
      if (event.