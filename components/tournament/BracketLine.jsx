import React from 'react';

// This component draws the connector lines between matches
const BracketLine = ({ x1, y1, x2, y2, type }) => {
  let path;
  
  switch (type) {
    case 'horizontal':
      path = `M ${x1} ${y1} L ${x2} ${y1}`;
      break;
    case 'vertical':
      path = `M ${x1} ${y1} L ${x1} ${y2}`;
      break;
    case 'corner':
      path = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
      break;
    default:
      path = `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  
  return (
    <path 
      d={path} 
      stroke="#ccc" 
      strokeWidth="2" 
      fill="none" 
    />
  );
};

export default BracketLine; 