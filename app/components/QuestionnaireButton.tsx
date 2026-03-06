'use client'

import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import MedicalQuestionnaireModal from './MedicalQuestionnaireModal'

export default function QuestionnaireButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white hover:bg-orange-50 text-orange-600 py-3 md:py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-orange-200 hover:border-orange-400 hover:scale-[1.01] shadow-sm"
      >
        <ClipboardList className="w-5 h-5" />
        <span className="text-base">문진표 발급</span>
      </button>
      <MedicalQuestionnaireModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
