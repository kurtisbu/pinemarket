
import React from 'react';
import ProgramCard from './ProgramCard';

const samplePrograms = [
  {
    title: "Advanced Trend Following Strategy",
    description: "A sophisticated trend-following strategy that combines multiple timeframes and RSI divergence for optimal entry and exit points.",
    price: 49.99,
    rating: 4.8,
    downloads: 1247,
    views: 8934,
    category: "Strategy",
    author: "TradePro",
    image: "/placeholder.svg",
    tags: ["Trend", "RSI", "Multi-timeframe"]
  },
  {
    title: "Volume Profile Indicator",
    description: "Professional volume profile indicator with VWAP integration and support/resistance level detection.",
    price: 29.99,
    rating: 4.9,
    downloads: 2156,
    views: 12450,
    category: "Indicator",
    author: "VolumeExpert",
    image: "/placeholder.svg",
    tags: ["Volume", "VWAP", "Support/Resistance"]
  },
  {
    title: "Smart Money Concepts Dashboard",
    description: "Complete dashboard showing institutional order flow, liquidity zones, and market structure analysis.",
    price: 79.99,
    rating: 4.7,
    downloads: 834,
    views: 6721,
    category: "Indicator",
    author: "SmartFlow",
    image: "/placeholder.svg",
    tags: ["SMC", "Order Flow", "Institutional"]
  },
  {
    title: "Fibonacci Auto Retracement",
    description: "Automatically draws Fibonacci retracements and extensions based on swing highs and lows with customizable alerts.",
    price: 24.99,
    rating: 4.6,
    downloads: 1789,
    views: 9876,
    category: "Indicator",
    author: "FibMaster",
    image: "/placeholder.svg",
    tags: ["Fibonacci", "Auto", "Alerts"]
  },
  {
    title: "Options Flow Scanner",
    description: "Real-time options flow scanner with unusual activity detection and whale tracking capabilities.",
    price: 89.99,
    rating: 4.8,
    downloads: 567,
    views: 4532,
    category: "Screener",
    author: "OptionsGuru",
    image: "/placeholder.svg",
    tags: ["Options", "Scanner", "Whale Tracking"]
  },
  {
    title: "Scalping Assistant Pro",
    description: "High-frequency scalping strategy with noise filtering and dynamic stop-loss management for 1-5 minute charts.",
    price: 39.99,
    rating: 4.5,
    downloads: 1456,
    views: 7843,
    category: "Strategy",
    author: "ScalpKing",
    image: "/placeholder.svg",
    tags: ["Scalping", "High Frequency", "Stop Loss"]
  }
];

const FeaturedPrograms = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Featured Pine Scripts</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the most popular and highest-rated Pine Script programs trusted by thousands of traders
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {samplePrograms.map((program, index) => (
            <ProgramCard key={index} {...program} />
          ))}
        </div>
        
        <div className="text-center mt-12">
          <button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white px-8 py-3 rounded-lg font-medium transition-all">
            View All Programs
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPrograms;
