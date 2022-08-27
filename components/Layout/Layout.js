import React from 'react'
import HeadTags from './HeadTags'
import Navbar from './Navbar'
import { Container } from 'semantic-ui-react'
import nprogress from 'nprogress'
import router from 'next/router'

function Layout({ children }) {
  router.onRouteChangeStart = () => nprogress.start()
  router.onRouteChangeComplete = () => nprogress.done()
  router.onRouteChangeError = () => nprogress.done()
  return (
    <>
      <HeadTags />

      <Navbar />

      <Container style={{ paddingTop: '1rem' }} text>
        {children}
      </Container>
    </>
  )
}

export default Layout
