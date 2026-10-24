import { useRoute } from './lib/router'
import { Editor } from './screens/editor/Editor'
import { Gallery } from './screens/Gallery'
import { Home } from './screens/Home'
import { Presenter } from './screens/Presenter'
import { System } from './screens/System'
import { installTooltips } from './screens/tooltip'
import { Wizard } from './screens/Wizard'

// 단추의 title을 바로 보이는 말풍선으로 (화면마다 따로 달지 않게 한 번만)
installTooltips()

export function App() {
  const route = useRoute()
  if (route.name === 'new') return <Wizard />
  if (route.name === 'edit') return <Editor key={route.id} id={route.id} />
  if (route.name === 'presenter') return <Presenter key={route.id} id={route.id} />
  if (route.name === 'system') return <System />
  if (route.name === 'gallery') return <Gallery key={location.hash} />
  return <Home />
}
