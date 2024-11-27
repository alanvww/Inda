import './App.css'
import Navbar from './components/global/navbar.tsx'
import Footer from './components/global/footer.tsx'
import ListView from './components/ListView.tsx'

function App() {

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main id='allList' className="flex flex-col flex-grow">
        <ListView />
      </main>
      <Footer />
    </div>
  )
}

export default App
