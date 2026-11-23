import { Connect, Unsupported } from './components/Connect'
import { Dashboard } from './components/Dashboard'
import { StationLink } from './station/link'
import { useStation } from './station/useStation'

export function App() {
  const station = useStation()
  if (!StationLink.supported) return <Unsupported />
  if (!station.data) return <Connect station={station} />
  return <Dashboard station={station} data={station.data} />
}
