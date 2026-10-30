export function animateCategoryCollapse({
  sec,
  collapse,
  onComplete,
}: {
  sec: HTMLElement;
  collapse: boolean;
  onComplete?: () => void;
}) {
  const body = sec.querySelector<HTMLElement>(".catbody");

  // Respect prefers-reduced-motion
  if (
    !body ||
    !body.animate ||
    (typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    sec.classList.toggle("collapsed", collapse);
    if (onComplete) onComplete();
    return;
  }

  // Cancel any running animations on this element
  const currentAnims = (sec as any)._an as Animation[] | undefined;
  if (currentAnims) {
    currentAnims.forEach((a) => a.cancel());
    (sec as any)._an = null;
  }

  if (!collapse) {
    sec.classList.remove("collapsed");
  }

  const H = body.offsetHeight;
  const els: HTMLElement[] = [];
  let n = sec.nextElementSibling as HTMLElement | null;
  while (n) {
    els.push(n);
    n = n.nextElementSibling as HTMLElement | null;
  }

  if (sec.parentNode && (sec.parentNode as HTMLElement).id === "cats") {
    let pNext = (sec.parentNode as HTMLElement).nextElementSibling as HTMLElement | null;
    while (pNext) {
      els.push(pNext);
      pNext = pNext.nextElementSibling as HTMLElement | null;
    }
  }

  const rad = getComputedStyle(sec).borderTopLeftRadius || "28px";
  const options: KeyframeAnimationOptions = {
    duration: 460,
    easing: "cubic-bezier(.2,0,0,1)",
    fill: "forwards",
  };

  function ins(px: number) {
    return `inset(0px 0px ${px}px 0px round ${rad})`;
  }

  function ty(px: number) {
    return `translateY(${px}px)`;
  }

  const A: Animation[] = [];

  // 1. Animate container clip-path
  A.push(
    sec.animate(
      collapse
        ? [{ clipPath: ins(0) }, { clipPath: ins(H) }]
        : [{ clipPath: ins(H) }, { clipPath: ins(0) }],
      options
    )
  );

  // 2. Animate subsequent elements translateY
  els.forEach((el) => {
    A.push(
      el.animate(
        collapse
          ? [{ transform: ty(0) }, { transform: ty(-H) }]
          : [{ transform: ty(-H) }, { transform: ty(0) }],
        options
      )
    );
  });

  // 3. Animate body opacity
  A.push(
    body.animate(
      collapse
        ? [{ opacity: 1 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }],
      options
    )
  );

  (sec as any)._an = A;

  A[0].onfinish = () => {
    sec.classList.toggle("collapsed", collapse);
    A.forEach((a) => a.cancel());
    (sec as any)._an = null;
    if (onComplete) onComplete();
  };
}
