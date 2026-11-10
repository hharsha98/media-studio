import React from "react";
import { Composition } from "remotion";
import { McpVideo } from "./McpVideo";
import type { VideoProps } from "./theme";

const defaultProps: VideoProps = {
  format: "16:9", width: 1920, height: 1080, fps: 30,
  theme: { background: "#F6F7FB", foreground: "#14213D", accent: "#2563EB", muted: "#5B6478", font: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif' },
  motion: { damping: 18, transitionFrames: 12, transition: "fade", travel: 36, stagger: 0.28 },
  labels: { aiVoice: false, narration: null, music: null, madeWith: "Made with Media Studio MCP" },
  music: null,
  sources: [],
  scenes: [{ id: "preview", kind: "title", heading: "Media Studio MCP", subtitle: "Preview", narration: "", durationFrames: 90, leadFrames: 10, audio: null, sourceTag: null, captions: [] }],
};

export const McpRoot: React.FC = () => (
  <Composition
    id="McpVideo"
    component={McpVideo}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={90}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, props.scenes.reduce((a, s) => a + s.durationFrames, 0)),
      width: props.width,
      height: props.height,
      fps: props.fps,
    })}
  />
);
