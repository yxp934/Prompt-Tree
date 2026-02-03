"use client";

import { useCallback, useState } from "react";

import { TreeView } from "./TreeView";

const EXPAND_FITVIEW_DELAY_MS = 220;

export function TreeCanvasFloating() {
  const [fitViewTrigger, setFitViewTrigger] = useState(0);

  const triggerFitView = useCallback(() => {
    window.setTimeout(() => {
      setFitViewTrigger((prev) => prev + 1);
    }, EXPAND_FITVIEW_DELAY_MS);
  }, []);

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20 lg:right-8 lg:top-6">
      <div
        className="group pointer-events-auto relative h-[110px] w-[170px] overflow-hidden rounded-xl transition-all duration-200 lg:h-[130px] lg:w-[210px] lg:hover:h-[min(640px,62vh)] lg:hover:w-[min(920px,calc(100vw_-_3rem))] lg:focus-within:h-[min(640px,62vh)] lg:focus-within:w-[min(920px,calc(100vw_-_3rem))] lg:hover:bg-paper lg:focus-within:bg-paper"
        onMouseEnter={() => triggerFitView()}
        onFocusCapture={() => triggerFitView()}
      >
        <div className="relative h-full w-full [&_.react-flow__attribution]:hidden [&_.react-flow__background]:opacity-0 [&_.react-flow__background]:transition-opacity [&_.react-flow__background]:duration-200 [&_.react-flow__renderer]:pointer-events-none [&_.react-flow__renderer]:opacity-0 [&_.react-flow__renderer]:transition-opacity [&_.react-flow__renderer]:duration-200 [&_.react-flow__panel]:!m-0 [&_.react-flow__minimap]:!inset-0 [&_.react-flow__minimap]:!h-full [&_.react-flow__minimap]:!w-full [&_.react-flow__minimap]:overflow-hidden [&_.react-flow__minimap_svg]:!h-full [&_.react-flow__minimap_svg]:!w-full [&_[data-tree-controls]]:hidden lg:group-hover:[&_.react-flow__background]:opacity-100 lg:group-hover:[&_.react-flow__renderer]:pointer-events-auto lg:group-hover:[&_.react-flow__renderer]:opacity-100 lg:group-hover:[&_.react-flow__minimap]:!top-auto lg:group-hover:[&_.react-flow__minimap]:!left-auto lg:group-hover:[&_.react-flow__minimap]:!right-4 lg:group-hover:[&_.react-flow__minimap]:!bottom-4 lg:group-hover:[&_.react-flow__minimap]:!h-[150px] lg:group-hover:[&_.react-flow__minimap]:!w-[210px] lg:group-hover:[&_.react-flow__minimap_svg]:!h-[150px] lg:group-hover:[&_.react-flow__minimap_svg]:!w-[210px] lg:group-hover:[&_[data-tree-controls]]:!flex lg:group-focus-within:[&_.react-flow__background]:opacity-100 lg:group-focus-within:[&_.react-flow__renderer]:pointer-events-auto lg:group-focus-within:[&_.react-flow__renderer]:opacity-100 lg:group-focus-within:[&_.react-flow__minimap]:!top-auto lg:group-focus-within:[&_.react-flow__minimap]:!left-auto lg:group-focus-within:[&_.react-flow__minimap]:!right-4 lg:group-focus-within:[&_.react-flow__minimap]:!bottom-4 lg:group-focus-within:[&_.react-flow__minimap]:!h-[150px] lg:group-focus-within:[&_.react-flow__minimap]:!w-[210px] lg:group-focus-within:[&_.react-flow__minimap_svg]:!h-[150px] lg:group-focus-within:[&_.react-flow__minimap_svg]:!w-[210px] lg:group-focus-within:[&_[data-tree-controls]]:!flex">
          <TreeView fitViewOnInit={false} fitViewTrigger={fitViewTrigger} />
        </div>
      </div>
    </div>
  );
}
