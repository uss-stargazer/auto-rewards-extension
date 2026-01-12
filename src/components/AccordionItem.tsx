import React, { PropsWithChildren, ReactNode, useState } from "react";

export default function AccordionItem({
  header,
  children,
}: PropsWithChildren<{ header: string | ReactNode }>) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="accordion-item">
      <div onClick={() => setIsOpen(!isOpen)}>
        {typeof header === "string" ? (
          <h3 className="accordion-item-header">{header}</h3>
        ) : (
          header
        )}
      </div>
      <div
        className="accordion-item-contents"
        style={{ display: isOpen ? undefined : "none" }}
      >
        {children}
      </div>
    </div>
  );
}
