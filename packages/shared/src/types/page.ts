export interface DOMNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  children: DOMNode[];
  boundingBox?: BoundingBox;
}

export interface AXNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  focused?: boolean;
  disabled?: boolean;
  children?: AXNode[];
}

export interface InteractiveElement {
  selector: string;
  type: 'button' | 'link' | 'input' | 'select' | 'textarea' | 'checkbox' | 'radio';
  text?: string;
  ariaLabel?: string;
  boundingBox: BoundingBox;
  enabled: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
