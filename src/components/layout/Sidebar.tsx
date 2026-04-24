"use client";

import { useSidebarStore } from "@/store/useSidebarStore";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Server, Shield, Key, Settings, 
  ChevronLeft, LogOut, Users, ChevronDown, Database, Warehouse, Box, Globe, Boxes, Wrench
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export const Sidebar = () => {
  const { isCollapsed, toggle } = useSidebarStore();
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const [openSubMenus, setOpenSubMenus] = useState<string[]>([]);
  const [dynamicDatacenters, setDynamicDatacenters] = useState<any[]>([]);

  // 1. Fetch live Datacenters to populate the 3rd level of the sidebar
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const res = await fetch("/api/locations?type=DATACENTER");
        const data = await res.json();
        setDynamicDatacenters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Sidebar fetch error:", err);
        setDynamicDatacenters([]);
      }
    };
    fetchSidebarData();
  }, [pathname]); // Refresh when path changes to catch new additions

  // 2. Auto-expand relevant menus based on current URL
  useEffect(() => {
    const activeMenus: string[] = [];
    if (pathname.includes("/assets")) activeMenus.push("Hardware");
    if (pathname.includes("/datacenters/")) activeMenus.push("Datacenters");
    if (pathname.includes("/network/")) activeMenus.push("Networking");
    if (pathname.includes("/products")) activeMenus.push("Products / Application");
    setOpenSubMenus(prev => Array.from(new Set([...prev, ...activeMenus])));
  }, [pathname]);

  const menuItems = [
    { 
      name: "Dashboard", 
      icon: LayoutDashboard, 
      path: "/", 
      roles: ["ADMIN", "OPERATOR", "VIEWER"] 
    },
    { 
      name: "Hardware", 
      icon: Server, 
      path: "/assets/hardware",
      roles: ["ADMIN", "OPERATOR", "VIEWER"],
      subItems: [
        { 
          name: "Datacenters", 
          path: "/assets/locations/datacenters", 
          icon: Database,
          // DEEP NESTING: Inject dynamic sites here
          children: dynamicDatacenters.map(dc => ({
            name: dc.name,
            path: `/assets/locations/datacenters/${dc.id}/racks`,
            icon: Box
          }))
        },
        { 
          name: "Warehouses", 
          path: "/assets/locations/warehouses", 
          icon: Warehouse 
        },
      ]
    },
    {
      name: "Networking",
      icon: Shield,
      path: "/network/public",
      roles: ["ADMIN", "OPERATOR", "VIEWER"],
      subItems: [
        {
          name: "Public IP Management",
          path: "/network/public",
          icon: Globe,
        },
        {
          name: "Private IP Management",
          path: "/network/private",
          icon: Shield,
        },
      ],
    },
    {
      name: "Products / Application",
      icon: Boxes,
      path: "/products",
      roles: ["ADMIN", "OPERATOR", "VIEWER"],
    },
    { name: "Licenses", icon: Key, path: "/licenses", roles: ["ADMIN", "OPERATOR", "VIEWER"] },
    { name: "Maintenance", icon: Wrench, path: "/maintenance", roles: ["ADMIN", "OPERATOR", "VIEWER"] },
    { name: "Users", icon: Users, path: "/users", roles: ["ADMIN"] },
    { name: "Settings", icon: Settings, path: "/settings", roles: ["ADMIN", "OPERATOR"] },
  ];

  const filteredItems = menuItems.filter((item) => 
    item.roles.includes(session?.user?.role as string)
  );

  const toggleMenu = (name: string) => {
    setOpenSubMenus(prev => 
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  return (
    <aside className={cn(
      "h-screen bg-[#111620] border-r border-slate-800 transition-all duration-300 flex flex-col z-50",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && <span className="font-bold text-xl tracking-tighter text-white">ElitGrid</span>}
        <button onClick={toggle} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">
          <ChevronLeft className={cn("transition-transform", isCollapsed && "rotate-180")} size={18} />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item) => {
          const isExpanded = openSubMenus.includes(item.name);
          const isParentActive =
            pathname === item.path ||
            item.subItems?.some((sub) => pathname === sub.path || pathname.startsWith(`${sub.path}/`));

          return (
            <div key={item.name} className="space-y-1">
              <div className={cn(
                "flex items-center rounded-xl transition-all group overflow-hidden",
                isParentActive ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-800/50"
              )}>
                <Link href={item.path} className="flex-1 flex items-center gap-3 p-3 transition-all">
                  <item.icon size={20} />
                  {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                </Link>
                {item.subItems && !isCollapsed && (
                  <button onClick={() => toggleMenu(item.name)} className="p-3 border-l border-white/5">
                    <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                  </button>
                )}
              </div>

              {/* LEVEL 2: Locations (Datacenters/Warehouses) */}
              {!isCollapsed && item.subItems && isExpanded && (
                <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1">
                  {item.subItems.map((sub) => {
                    const isSubExpanded = openSubMenus.includes(sub.name);
                    return (
                      <div key={sub.path} className="space-y-1">
                        <div className="flex items-center group">
                          <Link href={sub.path} className={cn(
                            "flex-1 flex items-center gap-3 p-2 rounded-lg text-xs transition-all",
                            pathname === sub.path ? "text-blue-400 font-bold bg-blue-400/5" : "text-slate-500 hover:text-slate-200"
                          )}>
                            <sub.icon size={14} />
                            <span>{sub.name}</span>
                          </Link>
                          {sub.children && (
                            <button onClick={() => toggleMenu(sub.name)} className="p-2 text-slate-600">
                              <ChevronDown size={12} className={cn(isSubExpanded && "rotate-180")} />
                            </button>
                          )}
                        </div>

                        {/* LEVEL 3: Specific Datacenters (DCI-Cibitung, etc) */}
                        {isSubExpanded && sub.children && (
                          <div className="ml-4 pl-2 border-l border-slate-800/50 space-y-1">
                            {sub.children.map(child => (
                              <Link key={child.path} href={child.path} className={cn(
                                "block p-2 text-[10px] rounded-md transition-all",
                                pathname === child.path ? "text-white bg-slate-800" : "text-slate-600 hover:text-slate-300"
                              )}>
                                • {child.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-3 p-3 text-slate-500 hover:text-red-400 w-full">
          <LogOut size={20} />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
};
