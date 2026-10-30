import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Stylesheets in cascade order — engine, shell, then this repo's theme (last, so its brand wins).
import '@graphlearning/graphl-flow/styles.css'
import '@graphlearning/shell/styles.css'
import './theme.css'
import { ConceptApp } from '@graphlearning/shell'
import { COURSES } from './content'
import { getScene } from './scenes'

// audioBase comes from here: import.meta.env.BASE_URL is this app's build-time value, which the
// separately built shell cannot read.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptApp subject="Linux" courses={COURSES} getScene={getScene} audioBase={import.meta.env.BASE_URL} />
  </StrictMode>,
)
