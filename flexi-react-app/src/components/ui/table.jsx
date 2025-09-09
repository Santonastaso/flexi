import React from 'react';

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto overflow-y-visible" style={{ maxHeight: '95vh' }}>
                      <table
                    ref={ref}
                    className={`w-full caption-bottom text-[10px] !text-[10px] relative ${className}`}
                    {...props}
                  />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={`sticky top-0 z-20 bg-gray-50 border-b border-gray-200 ${className}`} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={`bg-white ${className}`} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={`bg-gray-50 ${className}`} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={`border-b border-gray-200 transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-50 ${className}`}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
                    <th
                    ref={ref}
                    className={`h-6 px-1 text-left align-middle font-medium text-[10px] !text-[10px] text-gray-900 bg-gray-50 border-r border-gray-200 whitespace-nowrap ${className}`}
                    {...props}
                  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
                    <td
                    ref={ref}
                    className={`p-1 align-middle whitespace-nowrap text-[10px] !text-[10px] border-r border-gray-200 ${className}`}
                    {...props}
                  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
                    <caption
                    ref={ref}
                    className={`mt-2 text-[10px] text-gray-500 ${className}`}
                    {...props}
                  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
