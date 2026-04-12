import { Link, useLocation } from "react-router-dom";
import './TabNavigation.css'

interface Props {
  tabs: {
    label: string,
    path: string,
  }[]
}

export default function TabNavigation(props: Props) {
  const location = useLocation();

  return (
    <div className="TabNav">
      {
        props.tabs.map(tab => {
          return (
            <Link
              key={tab.path}
              className={`Tab ${tab.path === location.pathname ? 'active' : ''}`}
              to={tab.path}
            >
              {tab.label}
            </Link>
          )
        })
      }
    </div>
  )
}
