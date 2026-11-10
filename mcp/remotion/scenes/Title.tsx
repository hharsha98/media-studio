import React from "react";
import { fitSize, rgba, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

export const Title: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const { theme, motion } = p;
  const a = useEnter(4, motion.damping);
  const b = useEnter(4 + Math.round(motion.stagger * 30), motion.damping);
  const heading = s.heading ?? "";
  const size = fitSize(heading, box.cw, box.ch * 0.55, box.vertical ? 120 : 140, 40, 1.08);
  return (
    <div>
      <div style={{ width: 120 * a, height: 10, borderRadius: 6, background: theme.accent, marginBottom: 36 }} />
      <div
        style={{
          fontSize: size, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1.5, opacity: a,
          transform: `translateY(${(1 - a) * motion.travel}px)`, maxWidth: box.cw, overflowWrap: "break-word",
        }}
      >
        {heading}
      </div>
      {s.subtitle ? (
        <div
          style={{
            marginTop: 28, fontSize: fitSize(s.subtitle, box.cw, box.ch * 0.2, 52, 26), color: theme.muted, fontWeight: 500, opacity: b,
            transform: `translateY(${(1 - b) * motion.travel}px)`, borderLeft: `6px solid ${rgba(theme.accent, 0.9)}`, paddingLeft: 24,
          }}
        >
          {s.subtitle}
        </div>
      ) : null}
    </div>
  );
};
