import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useJobs } from '../hooks/useJobs'
import * as api from '../services/api'
import { hashColor } from '../utils/format'

// We'll use the legacy build of pdfjs-dist for broadest compatibility
import * as pdfjsLib from 'pdfjs-dist'

// Point the worker to unpkg CDN (mirrors npm, always has latest versions)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

const STEPS = [
  { id: 'upload', label: 'Upload Resume', icon: '📄' },
  { id: 'analyze', label: 'AI Analysis', icon: '🤖' },
  { id: 'tailor', label: 'Tailor Resume', icon: '✨' },
]

export default function ResumeUpload() {
  const navigate = useNavigate()
  const { parseResume, loading, step, error, sessionId, jobTitles, resumeText } = useSession()
  const { allJobs } = useJobs()
  const fileInputRef = useRef(null)

  const [drag, setDrag] = useState(false)
  const [fileName, setFileName] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [parsed, setParsed] = useState(false)

  // Tailoring state
  const [currentStep, setCurrentStep] = useState('upload')
  const [tailorMode, setTailorMode] = useState(null) // 'paste' | 'select' | null
  const [pastedJD, setPastedJD] = useState('')
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [jobSearch, setJobSearch] = useState('')
  const [tailoredResume, setTailoredResume] = useState('')
  const [tailoring, setTailoring] = useState(false)
  const [tailorError, setTailorError] = useState('')

  // Filtered scraped jobs for the selector
  const filteredScrapedJobs = useMemo(() => {
    if (!jobSearch) return allJobs.slice(0, 20)
    const q = jobSearch.toLowerCase()
    return allJobs.filter(j =>
      (j.title || '').toLowerCase().includes(q) ||
      (j.company || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [allJobs, jobSearch])

  // Extract text from PDF file using pdfjs-dist
  const extractTextFromPDF = useCallback(async (file) => {
    setExtracting(true)
    setFileName(file.name)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => item.str).join(' ')
        fullText += pageText + '\n\n'
      }

      setExtractedText(fullText.trim())
      return fullText.trim()
    } catch (err) {
      console.error('PDF extraction error:', err)
      throw new Error('Failed to extract text from PDF. Please try a different file.')
    } finally {
      setExtracting(false)
    }
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.')
      return
    }

    try {
      const text = await extractTextFromPDF(file)
      if (text.length < 50) {
        alert('Could not extract enough text from this PDF. Please try a different resume.')
        return
      }

      // Call parse-resume edge function
      setCurrentStep('analyze')
      await parseResume(text)
      setParsed(true)
      setCurrentStep('tailor')
    } catch (err) {
      console.error('Upload error:', err)
    }
  }, [extractTextFromPDF, parseResume])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer?.files?.[0]
    handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDrag(true)
  }, [])

  const handleDragLeave = useCallback(() => setDrag(false), [])

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0]
    handleFile(file)
  }, [handleFile])

  const goToDashboard = () => navigate('/ai-dashboard')

  // Handle resume tailoring
  const handleTailor = async () => {
    setTailoring(true)
    setTailorError('')
    try {
      if (!sessionId) throw new Error('No active session. Please upload a resume first.')

      let jdText = ''
      let jobTitle = ''
      let company = ''

      if (tailorMode === 'paste') {
        if (!pastedJD.trim()) throw new Error('Please paste a job description')
        jdText = pastedJD
        jobTitle = 'Target Role'
        company = 'Target Company'
      } else if (tailorMode === 'select') {
        const job = allJobs.find(j => j.id === selectedJobId)
        if (!job) throw new Error('Please select a job')
        jdText = job.description || `${job.title} at ${job.company}`
        jobTitle = job.title
        company = job.company
      }

      // Call the rewrite-resume edge function via the API service (with auth)
      const data = await api.rewriteResume(sessionId, {
        custom_jd: jdText.slice(0, 4000),
        custom_title: jobTitle,
        custom_company: company,
      })
      setTailoredResume(data.rewritten_resume)
    } catch (err) {
      setTailorError(err.message)
    } finally {
      setTailoring(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([tailoredResume], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume_tailored_${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      className="max-w-3xl mx-auto px-4 sm:px-6 pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div
        className="text-center py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Resume <span className="gradient-text">Studio</span>
        </h1>
        <p className="text-dark-muted text-sm font-mono mt-2 max-w-md mx-auto">
          Upload your resume, AI analyzes it, then tailor it for any job description
        </p>
      </motion.div>

      {/* Step Progress */}
      <motion.div
        className="flex items-center justify-center gap-2 mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {STEPS.map((s, i) => {
          const isActive = s.id === currentStep
          const isComplete = STEPS.findIndex(x => x.id === currentStep) > i
          return (
            <div key={s.id} className="flex items-center gap-2">
              <motion.div
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs border transition-all ${
                  isActive
                    ? 'bg-accent/10 text-accent border-accent/30'
                    : isComplete
                      ? 'bg-dark-card text-accent/60 border-dark-border'
                      : 'bg-dark-card text-dark-muted border-dark-border/50'
                }`}
                animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span>{isComplete ? '✓' : s.icon}</span>
                <span className="hidden sm:block">{s.label}</span>
              </motion.div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${isComplete ? 'bg-accent/40' : 'bg-dark-border'}`} />
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <motion.div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            drag
              ? 'border-accent bg-accent/5 shadow-glow'
              : parsed
                ? 'border-accent/30 bg-accent/5'
                : 'border-dark-border hover:border-accent/30 hover:bg-dark-card/50'
          }`}
          onClick={() => !parsed && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          whileHover={!parsed ? { scale: 1.005 } : {}}
          whileTap={!parsed ? { scale: 0.995 } : {}}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="hidden"
            id="resume-upload-input"
          />

          {extracting || (loading && step === 'parsing') ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                className="w-14 h-14 border-2 border-accent/30 border-t-accent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <div>
                <p className="text-white font-display font-bold text-lg">
                  {extracting ? 'Extracting text from PDF...' : 'AI is analyzing your resume...'}
                </p>
                <p className="text-dark-muted text-xs font-mono mt-1">
                  {extracting ? 'Reading document pages' : 'Identifying best-fit job titles'}
                </p>
              </div>
            </div>
          ) : parsed ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-accent text-2xl">✓</span>
              </div>
              <div>
                <p className="text-accent font-display font-bold text-lg">Resume Analyzed</p>
                <p className="text-dark-muted text-xs font-mono mt-1">
                  {fileName} · Session: {sessionId?.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setParsed(false)
                  setCurrentStep('upload')
                  setFileName('')
                  setExtractedText('')
                  setTailoredResume('')
                  setTailorMode(null)
                }}
                className="text-xs font-mono text-dark-muted hover:text-white transition-colors mt-1"
              >
                ↑ Upload different resume
              </button>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3 opacity-40">
                {drag ? '📥' : '📤'}
              </div>
              <p className="text-white font-display font-bold text-lg">
                {fileName ? fileName : 'Drop your resume here'}
              </p>
              <p className="text-dark-muted text-xs font-mono mt-2">
                or click to browse · PDF only · max 10MB
              </p>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-mono"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ✗ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results — Job Titles */}
      <AnimatePresence>
        {parsed && jobTitles.length > 0 && (
          <motion.div
            className="mt-6 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Extracted titles */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
              <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4 font-bold">
                Best-Fit Job Titles
              </h3>
              <div className="flex flex-wrap gap-2">
                {jobTitles.map((title, i) => (
                  <motion.span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-accent/5 text-accent border border-accent/10 font-mono text-xs"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    {title}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* CTA: Go to AI Dashboard */}
            <motion.button
              onClick={goToDashboard}
              className="premium-btn w-full py-4 rounded-2xl text-lg"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue to AI Dashboard →
            </motion.button>

            {/* ─── TAILOR SECTION ─── */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg mb-1">
                Tailor Your <span className="gradient-text">Resume</span>
              </h3>
              <p className="text-dark-muted text-xs font-mono mb-5">
                Get an AI-optimized resume tailored for a specific job description
              </p>

              {/* Mode Selection */}
              {!tailoredResume && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <motion.button
                    onClick={() => setTailorMode('paste')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      tailorMode === 'paste'
                        ? 'bg-accent/5 border-accent/30 text-accent'
                        : 'border-dark-border hover:border-accent/20'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-xl mb-2">📋</div>
                    <p className="font-display font-bold text-sm">Paste JD</p>
                    <p className="text-[11px] font-mono text-dark-muted mt-1">
                      Paste a job description manually
                    </p>
                  </motion.button>
                  <motion.button
                    onClick={() => setTailorMode('select')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      tailorMode === 'select'
                        ? 'bg-accent/5 border-accent/30 text-accent'
                        : 'border-dark-border hover:border-accent/20'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-xl mb-2">🔍</div>
                    <p className="font-display font-bold text-sm">Select from Jobs</p>
                    <p className="text-[11px] font-mono text-dark-muted mt-1">
                      Pick from {allJobs.length} scraped jobs
                    </p>
                  </motion.button>
                </div>
              )}

              {/* Paste JD Mode */}
              <AnimatePresence>
                {tailorMode === 'paste' && !tailoredResume && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <textarea
                      value={pastedJD}
                      onChange={e => setPastedJD(e.target.value)}
                      placeholder="Paste the job description here..."
                      className="premium-input w-full h-40 rounded-xl resize-none"
                      id="paste-jd-textarea"
                    />
                    <motion.button
                      onClick={handleTailor}
                      disabled={tailoring || !pastedJD.trim()}
                      className="premium-btn w-full py-3 rounded-xl font-display font-bold text-sm"
                      whileTap={{ scale: 0.98 }}
                    >
                      {tailoring ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            className="w-4 h-4 border-2 border-dark-bg/30 border-t-dark-bg rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                          Tailoring...
                        </span>
                      ) : '✦ Tailor My Resume'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Select Job Mode */}
              <AnimatePresence>
                {tailorMode === 'select' && !tailoredResume && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      placeholder="Search jobs by title or company..."
                      className="premium-input w-full rounded-xl"
                      id="job-search-input"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredScrapedJobs.map(job => (
                        <motion.button
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                            selectedJobId === job.id
                              ? 'bg-accent/10 border border-accent/20'
                              : 'hover:bg-dark-hover border border-transparent'
                          }`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: hashColor(job.company || '') }}
                          >
                            {(job.company || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{job.title}</p>
                            <p className="text-[10px] text-dark-muted truncate">{job.company} · {job.platform}</p>
                          </div>
                          {selectedJobId === job.id && (
                            <span className="text-accent text-xs ml-auto shrink-0">✓</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                    <motion.button
                      onClick={handleTailor}
                      disabled={tailoring || !selectedJobId}
                      className="premium-btn w-full py-3 rounded-xl font-display font-bold text-sm"
                      whileTap={{ scale: 0.98 }}
                    >
                      {tailoring ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            className="w-4 h-4 border-2 border-dark-bg/30 border-t-dark-bg rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                          Tailoring...
                        </span>
                      ) : '✦ Tailor My Resume'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tailor Error */}
              {tailorError && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm font-mono">
                  ✗ {tailorError}
                </div>
              )}

              {/* Tailored Resume Result */}
              <AnimatePresence>
                {tailoredResume && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-xs text-accent uppercase tracking-wider font-bold">
                        Tailored Resume
                      </h4>
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => { setTailoredResume(''); setTailorMode(null) }}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono text-dark-muted border border-dark-border hover:text-white transition-colors"
                          whileTap={{ scale: 0.95 }}
                        >
                          ↺ Start Over
                        </motion.button>
                        <motion.button
                          onClick={handleDownload}
                          className="premium-btn-outline px-4 py-1.5 rounded-lg text-xs"
                          whileTap={{ scale: 0.95 }}
                        >
                          ↓ Download
                        </motion.button>
                      </div>
                    </div>
                    <textarea
                      value={tailoredResume}
                      onChange={e => setTailoredResume(e.target.value)}
                      className="premium-input w-full h-[400px] rounded-xl resize-none text-sm leading-relaxed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions (only shown before upload) */}
      {!parsed && (
        <motion.div
          className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              className="bg-dark-card border border-dark-border rounded-xl p-4 text-center"
              whileHover={{ y: -2, borderColor: 'rgba(0, 255, 136, 0.2)' }}
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-xs font-display font-bold">{s.label}</p>
              <p className="text-[10px] font-mono text-dark-muted mt-1">
                {i === 0 ? 'PDF text extracted client-side' : i === 1 ? 'Gemini extracts job titles' : 'Tailor for any job JD'}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

/* ─── Helpers ───────────────────────────────────────── */
// hashColor imported from '../utils/format'
