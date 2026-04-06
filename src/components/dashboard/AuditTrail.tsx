import React from 'react';
import { Activity, ArrowRightLeft, Pencil, Plus, Trash2 } from 'lucide-react';

interface AuditTrailItem {
  id: string;
  action: string;
  title: string;
  details?: string;
  createdAt: string | Date;
}

const iconForAction = (action: string) => {
  switch (action) {
    case "CREATE":
      return { Icon: Plus, className: "text-emerald-400" };
    case "MOVE":
      return { Icon: ArrowRightLeft, className: "text-purple-400" };
    case "UPDATE":
      return { Icon: Pencil, className: "text-blue-400" };
    case "DELETE":
      return { Icon: Trash2, className: "text-rose-400" };
    default:
      return { Icon: Activity, className: "text-slate-300" };
  }
};

export const AuditTrail = ({ items }: { items: AuditTrailItem[] }) => {
  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {items.map((item, idx) => {
          const { Icon, className } = iconForAction(item.action);
          const createdAt = new Date(item.createdAt);
          return (
          <li key={item.id}>
            <div className="relative pb-8">
              {idx !== items.length - 1 && (
                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-800" aria-hidden="true" />
              )}
              <div className="relative flex space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 ring-8 ring-[#0f1218]">
                  <Icon size={14} className={className} />
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    {item.details ? (
                      <p className="text-xs text-slate-400 mt-0.5">{item.details}</p>
                    ) : null}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-slate-500">
                    {createdAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          </li>
        )})}
      </ul>
    </div>
  );
};
