import './App.css'
import Navbar from './components/global/navbar.tsx'
import Footer from './components/global/footer.tsx'
import ListView from './components/ListView.tsx'
import { ToastProvider } from './context/ToastContext'
import { ListProvider } from './context/ListContext'

function App() {
  return (
    <ToastProvider>
      <ListProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main id='allList' className="flex flex-col flex-grow">
            <ListView />
          </main>
          <Footer />
        </div>
      </ListProvider>
    </ToastProvider>
  )
}

export default App
