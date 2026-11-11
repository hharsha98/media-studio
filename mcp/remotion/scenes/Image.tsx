import React from "react";
import { Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { fitSize, type Box, type SceneData, type VideoProps } from "../theme";

export const ImageScene: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const frame = useCurrentFrame();
  const { theme } = p;
  const zoom = interpolate(frame, [0, s.durationFrames], [1, 1.08]);
  const head = s.heading ?? "";
  const headSize = head ? fitSize(head, box.cw, box.ch * 0.14, 60, 28, 1.1) : 0;
  const imgH = box.ch - (head ? headSize * 1.1 + 30 : 0) - 44;
  return (
    <div>
      {head ? <div style={{ fontSize: headSize, fontWeight: 800, marginBottom: 24, lineHeight: 1.1 }}>{head}</div> : null}
      <div style={{ width: box.cw, height: imgH, overflow: "hidden", borderRadius: 24, background: "#000" }}>
        {s.image ? <Img src={staticFile(s.image.path)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} /> : null}
      </div>
      <div style={{ marginTop: 12, fontSize: 24, color: theme.muted }}>{s.image?.credit}</div>
    </div>
  );
};
