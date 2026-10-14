"use client";

import { useState } from "react";

interface AccordionProps {
  items: { question: string; answer: string }[];
}

export default function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-charcoal-100 border border-charcoal-100">
      {items.map((item, index) => (
        <div key={index} className="group">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-cream-100 transition-colors duration-200"
          >
            <span className="font-serif text-lg text-charcoal-900 pr-4">
              {item.question}
            </span>
            <span
              className={`flex-shrink-0 w-8 h-8 rounded-full border border-charcoal-200 flex items-center justify-center transition-transform duration-300 ${
                openIndex === index ? "rotate-45 bg-charcoal-900 text-cream-50" : ""
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-6 pb-5 text-charcoal-600 leading-relaxed">
              {item.answer}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
