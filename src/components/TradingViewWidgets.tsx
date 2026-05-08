import { useEffect, useRef } from "react";

export function TradingViewChart({ symbol, height = 460 }: { symbol: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const container = document.createElement("div");
    container.className = "tradingview-widget-container__widget";
    container.style.height = "100%";
    container.style.width = "100%";
    ref.current.appendChild(container);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      backgroundColor: "rgba(0,0,0,1)",
      gridColor: "rgba(255,255,255,0.06)",
      studies: ["MASimple@tv-basicstudies", "MASimple@tv-basicstudies"],
      studies_overrides: {
        "moving average.length": 100,
      },
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(script);
  }, [symbol]);
  return <div ref={ref} className="tradingview-widget-container" style={{ height, width: "100%" }} />;
}

export function TradingViewTickerTape({ symbols }: { symbols: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const container = document.createElement("div");
    container.className = "tradingview-widget-container__widget";
    ref.current.appendChild(container);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: symbols.map((s) => ({ proName: s, title: s.split(":").pop() })),
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });
    ref.current.appendChild(script);
  }, [symbols.join(",")]);
  return <div ref={ref} className="tradingview-widget-container" />;
}
