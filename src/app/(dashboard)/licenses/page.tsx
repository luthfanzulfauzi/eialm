"use client";

import { useState, useEffect } from "react";
import { Key, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function LicensePage() {
  const [licenses, setLicenses] = useState([]);

  useEffect(() => {
    fetch("/api/licenses").then(res => res.json()).then(data => setLicenses(data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">License Manager</h1>
          <p className="text-slate-500 text-sm">Track software keys and subscription lifecycles</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">
          + Add License
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {licenses.map((license: any) => {
          const isExpiring = license.expiryDate && new Date(license.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const isExpired = license.isExpired;

          return (
            <div key={license.id} className="bg-[#151921] border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                  <Key size={20} />
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  isExpired ? 'bg-red-500/10 text-red-500' : 
                  isExpiring ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Active'}
                </span>
              </div>

              <h3 className="text-white font-bold text-lg mb-1">{license.name}</h3>
              <p className="text-slate-500 text-xs font-mono mb-4 break-all">{license.key}</p>

              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Clock size={14} /> Expiry Date
                  </span>
                  <span className="text-slate-300">
                    {license.expiryDate ? format(new Date(license.expiryDate), 'MMM dd, yyyy') : 'Perpetual'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-2">
                    <AlertCircle size={14} /> Assigned Asset
                  </span>
                  <span className="text-blue-400 underline cursor-pointer">
                    {license.asset?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}