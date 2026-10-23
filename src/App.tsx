import { useRoute } from './lib/router'
import { Editor } from './screens/editor/Editor'
import { Gallery } from './screens/Gallery'
import { Home } from './screens/Home'
import { Presenter } from './screens/Presenter'
import { System } from './screens/System'
import { Wizard } from './screens/Wizard'

export function App() {
  const route = useRoute()
  if (route.name === 'new') return <Wizard />
  if (route.name === 'edit') return <Editor key={route.id} id={route.id} />
  if (route.name === 'presenter') return <Presenter key={route.id} id={route.id} />
  if (route.name === 'system') return <System />
  if (route.name === 'gallery') return <Gallery key={location.hash} />
  return <Home />
}
