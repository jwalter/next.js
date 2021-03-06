import { createElement } from 'react'
import ReactDOM from 'react-dom'
import mitt from 'mitt'
import HeadManager from './head-manager'
import { createRouter } from '../lib/router'
import App from '../lib/app'
import evalScript from '../lib/eval-script'
import { loadGetInitialProps, getURL } from '../lib/utils'

// Polyfill Promise globally
// This is needed because Webpack2's dynamic loading(common chunks) code
// depends on Promise.
// So, we need to polyfill it.
// See: https://github.com/webpack/webpack/issues/4254
if (!window.Promise) {
  window.Promise = Promise
}

const {
  __NEXT_DATA__: {
    component,
    errorComponent,
    props,
    err,
    pathname,
    query
  },
  location
} = window

const Component = evalScript(component).default
const ErrorComponent = evalScript(errorComponent).default
let lastAppProps

export const router = createRouter(pathname, query, getURL(), {
  Component,
  ErrorComponent,
  err
})

const headManager = new HeadManager()
const container = document.getElementById('__next')

export default (onError) => {
  const emitter = mitt()

  router.subscribe(({ Component, props, hash, err }) => {
    render({ Component, props, err, hash, emitter }, onError)
  })

  const hash = location.hash.substring(1)
  render({ Component, props, hash, err, emitter }, onError)

  return emitter
}

export async function render (props, onError = renderErrorComponent) {
  try {
    await doRender(props)
  } catch (err) {
    await onError(err)
  }
}

async function renderErrorComponent (err) {
  const { pathname, query } = router
  const props = await loadGetInitialProps(ErrorComponent, { err, pathname, query })
  await doRender({ Component: ErrorComponent, props, err })
}

async function doRender ({ Component, props, hash, err, emitter }) {
  if (!props && Component &&
    Component !== ErrorComponent &&
    lastAppProps.Component === ErrorComponent) {
    // fetch props if ErrorComponent was replaced with a page component by HMR
    const { pathname, query } = router
    props = await loadGetInitialProps(Component, { err, pathname, query })
  }

  if (emitter) {
    emitter.emit('before-reactdom-render', { Component })
  }

  Component = Component || lastAppProps.Component
  props = props || lastAppProps.props

  const appProps = { Component, props, hash, err, router, headManager }
  // lastAppProps has to be set before ReactDom.render to account for ReactDom throwing an error.
  lastAppProps = appProps

  ReactDOM.render(createElement(App, appProps), container)

  if (emitter) {
    emitter.emit('after-reactdom-render', { Component })
  }
}
