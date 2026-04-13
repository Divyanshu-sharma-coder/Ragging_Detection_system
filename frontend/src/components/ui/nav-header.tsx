import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Panel", to: "/panel" },
  { label: "Account", to: "/auth" },
];

function NavHeader() {
  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-3">
      <ul className="mx-auto flex w-fit items-center gap-1 rounded-full border-2 border-black/80 bg-white/95 p-1 shadow-xl">
        {navItems.map((item) => (
          <Tab key={item.to} to={item.to}>
            {item.label}
          </Tab>
        ))}
      </ul>
    </div>
  );
}

const Tab = ({
  children,
  to,
}: {
  children: string;
  to: string;
}) => {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `block rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:px-5 md:py-3 md:text-xs ${
            isActive ? "bg-black text-white" : "text-black hover:bg-black/10"
          }`
        }
      >
        {children}
      </NavLink>
    </li>
  );
};

export default NavHeader;
