'use client'

import { useEffect } from 'react'
import { useStudio } from '@/lib/store'
import LibraryView from '@/components/studio/LibraryView'
import EditorView from '@/components/studio/EditorView'
import WizardDialog from '@/components/studio/WizardDialog'
import SettingsDialog from '@/components/studio/SettingsDialog'
import CoverDialog from '@/components/studio/CoverDialog'
import ExportDialog from '@/components/studio/ExportDialog'
import PrintView from '@/components/studio/PrintView'

export default function Home() {
  const view = useStudio((s) => s.view)
  const init = useStudio((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="min-h-screen">
      <div className="screen-only min-h-screen">
        {view === 'library' ? <LibraryView /> : <EditorView />}
      </div>
      <PrintView />
      <WizardDialog />
      <SettingsDialog />
      <CoverDialog />
      <ExportDialog />
    </div>
  )
}
