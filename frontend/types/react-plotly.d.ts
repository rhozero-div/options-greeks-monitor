declare module "react-plotly.js" {
  import { ComponentType } from "react";
  import type { Data, Layout, Config } from "plotly.js";

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    style?: { [key: string]: string | number | undefined };
    config?: Partial<Config>;
    useResizeHandler?: boolean;
    className?: string;
  }

  const Plot: ComponentType<PlotParams>;
  export default Plot;
}
