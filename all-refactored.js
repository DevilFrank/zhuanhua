// 独立重构版本：保留客户端占位符和 allACtion 调用协议。
// 私有动作工具集中在 AdActionRuntime；表单识别与曝光保留原公共入口。

var ADS_RECOGNITION_CONFIG = {
	fieldSelector: 'input, textarea, select',
	buttonSelector: 'button, input[type="submit"], input[type="button"], [role="button"], a',
	candidateSelector:
		'form, [role="form"], dialog, [role="dialog"], section, main, aside, div[class*="form"], div[id*="form"], div[class*="modal"], div[id*="modal"], div[class*="popup"], div[id*="popup"], div[class*="signup"], div[class*="register"], div[class*="lead"]',
	positiveKeywords: ['quote', 'apply', 'eligibility', 'estimate', 'lead', 'contact', 'request', 'started'],
	negativeKeywords: ['search', 'newsletter', 'subscribe', 'login', 'log in', 'sign in', 'password', 'forgot password'],
	searchHints: ['search', 'query', 'keyword', 'site search', 'find'],
	submitKeywords: [
		'submit',
		'continue',
		'next',
		'apply',
		'claim',
		'get started',
		'get quote',
		'check eligibility',
		'sign up',
		'register',
		'see results',
		'start',
		'join now',
		'continue now',
		'get my quote',
		'get my results',
		'check now',
		'start now',
		'next step',
		'proceed',
		'calculate',
		'find out',
		'get matched',
		'show me',
		'show results',
		'get result',
		'get results',
		'enviar',
		'continuar',
		'siguiente',
	],
	maxCandidates: 5,
	maxFieldAncestorDepth: 5,
}
var ADS_FORM_STEPS = [
	'fullName',
	'age',
	'telephone',
	'temporaryMail',
	'address',
	'city',
	'state',
	'zipCode',
	'birthday',
	'gender',
	'companyName',
	'occupation',
	'monthlySalary',
	'employmentStatus',
]
var ADS_FORM_DATA_BASE_URL = 'https://adcenter.airmobyte.com/prod-api/common/getFormDataInfo?countryCode='
var ADS_FIELD_ALIASES = {
	fullName: ['name', 'full name', 'fullname', 'first name', 'last name', 'your name', '姓名', 'nombre', 'contact name'],
	age: ['age', 'years old', 'edad', '年龄'],
	telephone: ['phone', 'mobile', 'tel', 'telephone', 'phone number', 'mobile number', '电话', '手机', 'telefono', 'celular'],
	temporaryMail: ['email', 'e-mail', 'mail', 'email address', 'temporary mail', 'correo'],
	address: ['address', 'street', 'street address', 'address line 1', 'direccion'],
	city: ['city', 'town', 'ciudad'],
	state: ['state', 'province', 'region', 'estado'],
	zipCode: ['zip', 'zipcode', 'zip code', 'postal', 'postal code', 'postcode'],
	birthday: ['birthday', 'birth date', 'birthdate', 'date of birth', 'dob', 'fecha de nacimiento'],
	gender: ['gender', 'sex', 'sexo'],
	companyName: ['company', 'company name', 'employer', 'business name'],
	occupation: ['occupation', 'job', 'job title', 'profession', 'work'],
	monthlySalary: ['salary', 'monthly salary', 'income', 'monthly income', 'earnings'],
	employmentStatus: ['employment', 'employment status', 'work status'],
}
var ADS_PRIMARY_FORM_STEPS = ['fullName', 'temporaryMail', 'telephone']
var ADS_SUPPORTING_FORM_STEPS = [
	'age',
	'address',
	'city',
	'state',
	'zipCode',
	'birthday',
	'gender',
	'companyName',
	'occupation',
	'monthlySalary',
	'employmentStatus',
]
var ADS_NON_FIELD_INPUT_TYPES = ['hidden', 'submit', 'button', 'reset', 'image', 'file']
var adsNormalizeSpace = value =>
	String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
var adsNormalizeText = value =>
	adsNormalizeSpace(value)
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
		.trim()
var adsQueryAll = (root, selector) => Array.from(root?.querySelectorAll?.(selector) || [])
var adsIsVisible = element => {
	if (!element || typeof element.getBoundingClientRect !== 'function') return false
	const view = element.ownerDocument?.defaultView || window
	const rect = element.getBoundingClientRect()
	const style = view.getComputedStyle(element)
	return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
}
var adsTextMatches = (text, keywords, exactScore, includeScore) => {
	const normalizedText = adsNormalizeText(text)
	return keywords.reduce((score, keyword) => {
		const normalizedKeyword = adsNormalizeText(keyword)
		if (!normalizedKeyword) return score
		if (normalizedText === normalizedKeyword) return Math.max(score, exactScore)
		return normalizedText.includes(normalizedKeyword) ? Math.max(score, includeScore) : score
	}, 0)
}
var adsGetTextByIds = (element, attributeName) =>
	String(element.getAttribute(attributeName) || '')
		.split(/\s+/)
		.map(id => id && element.ownerDocument.getElementById(id))
		.filter(Boolean)
		.map(item => adsNormalizeSpace(item.textContent))
		.filter(Boolean)
		.join(' | ')
var getAdsDataText = element =>
	[
		element.getAttribute('data-testid'),
		element.getAttribute('data-test'),
		element.getAttribute('data-cy'),
		element.getAttribute('data-name'),
		element.getAttribute('data-label'),
		element.getAttribute('data-placeholder'),
	].join(' ')
var getAdsFieldLabel = element => {
	const parentLabel = element.closest('label')
	if (parentLabel) return adsNormalizeSpace(parentLabel.textContent)
	const labels = element.labels ? Array.from(element.labels) : []
	if (labels.length)
		return labels
			.map(label => adsNormalizeSpace(label.textContent))
			.filter(Boolean)
			.join(' | ')
	if (!element.id) return adsGetTextByIds(element, 'aria-labelledby')
	const label = Array.from(element.ownerDocument.querySelectorAll('label')).find(item => item.htmlFor === element.id)
	return label ? adsNormalizeSpace(label.textContent) : adsGetTextByIds(element, 'aria-labelledby')
}
var getAdsWrapperText = element => {
	let current = element.parentElement
	for (let depth = 0; current && depth < 3; depth += 1, current = current.parentElement) {
		const text = adsNormalizeSpace(current.textContent)
		if (text && text.length <= 180) return text
	}
	return ''
}
var getAdsNearbyText = element =>
	[
		element?.previousElementSibling?.textContent,
		element?.nextElementSibling?.textContent,
		element?.parentElement?.previousElementSibling?.textContent,
		element?.parentElement?.nextElementSibling?.textContent,
		adsGetTextByIds(element, 'aria-describedby'),
	]
		.map(adsNormalizeSpace)
		.filter(Boolean)
		.join(' | ')
		.slice(0, 240)
var summarizeAdsClickable = element => ({
	tagName: element.tagName.toLowerCase(),
	type: String(element.getAttribute('type') || '').toLowerCase(),
	text: adsNormalizeSpace(element.textContent || element.value || ''),
	ariaLabel: element.getAttribute('aria-label') || '',
	title: element.getAttribute('title') || '',
	href: element.getAttribute('href') || '',
	name: element.getAttribute('name') || '',
	id: element.id || '',
	className: adsNormalizeSpace(element.className),
	download: element.hasAttribute('download'),
	visible: adsIsVisible(element),
})
var getAdsFieldSummary = element => ({
	tagName: element.tagName.toLowerCase(),
	type: String(element.getAttribute('type') || '').toLowerCase(),
	name: element.getAttribute('name') || '',
	id: element.id || '',
	className: adsNormalizeSpace(element.className),
	placeholder: element.getAttribute('placeholder') || '',
	ariaLabel: element.getAttribute('aria-label') || '',
	autocomplete: element.getAttribute('autocomplete') || '',
	labelText: getAdsFieldLabel(element),
	nearbyText: getAdsNearbyText(element),
	wrapperText: getAdsWrapperText(element),
	dataText: getAdsDataText(element),
	inputMode: element.getAttribute('inputmode') || '',
	visible: adsIsVisible(element),
	disabled: Boolean(element.disabled),
	readOnly: Boolean(element.readOnly),
	required: Boolean(element.required),
})
var getAdsVisibleFields = (root, config) =>
	adsQueryAll(root, config.fieldSelector)
		.map(field => ({ element: field, summary: getAdsFieldSummary(field) }))
		.filter(({ summary }) => summary.visible && !summary.disabled && !summary.readOnly && !ADS_NON_FIELD_INPUT_TYPES.includes(summary.type))
var adsUniqueElements = elements => {
	const used = new Set()
	return elements.filter(element => {
		if (!element || used.has(element)) return false
		used.add(element)
		return true
	})
}
var adsElementContains = (container, child) => container === child || Boolean(container?.contains?.(child))
var adsGetRect = element => (element && typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null)
var getAdsEntriesBounds = entries => {
	const rects = entries.map(({ element }) => adsGetRect(element)).filter(rect => rect && rect.width > 0 && rect.height > 0)
	if (!rects.length) return null
	return {
		left: Math.min(...rects.map(rect => rect.left)),
		top: Math.min(...rects.map(rect => rect.top)),
		right: Math.max(...rects.map(rect => rect.right)),
		bottom: Math.max(...rects.map(rect => rect.bottom)),
		width: Math.max(...rects.map(rect => rect.right)) - Math.min(...rects.map(rect => rect.left)),
		height: Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top)),
	}
}
var isAdsRootContainer = element => {
	const tagName = String(element?.tagName || '').toLowerCase()
	return tagName === 'html' || tagName === 'body'
}
var getAdsFieldCandidateContainers = (fieldEntry, config) => {
	const field = fieldEntry.element
	const containers = []
	if (field.form) containers.push(field.form)
	const semanticContainer = field.closest(config.candidateSelector)
	if (semanticContainer) containers.push(semanticContainer)
	let current = field.parentElement
	for (let depth = 0; current && depth < config.maxFieldAncestorDepth; depth += 1, current = current.parentElement) {
		if (isAdsRootContainer(current)) break
		containers.push(current)
	}
	return adsUniqueElements(containers).filter(adsIsVisible)
}
var getAdsCandidateContainers = (root, fieldEntries, config) =>
	adsUniqueElements([
		...adsQueryAll(root, config.candidateSelector),
		...fieldEntries.flatMap(fieldEntry => getAdsFieldCandidateContainers(fieldEntry, config)),
	]).filter(element => adsIsVisible(element) && !isAdsRootContainer(element))
var summarizeAdsCandidate = (element, fieldEntries, config) => {
	const textBlob = adsNormalizeText(element.textContent)
	const fieldText = fieldEntries
		.map(({ summary }) =>
			[
				summary.type,
				summary.name,
				summary.id,
				summary.placeholder,
				summary.ariaLabel,
				summary.autocomplete,
				summary.labelText,
				summary.nearbyText,
				summary.wrapperText,
				summary.dataText,
			].join(' '),
		)
		.join(' ')
	let domDepth = 0
	for (let parent = element.parentElement; parent; parent = parent.parentElement) domDepth += 1
	return {
		tagName: element.tagName.toLowerCase(),
		id: element.id || '',
		className: adsNormalizeSpace(element.className),
		visibleFieldCount: fieldEntries.length,
		requiredFieldCount: fieldEntries.filter(({ summary }) => summary.required).length,
		visibleButtonCount: adsQueryAll(element, config.buttonSelector).filter(adsIsVisible).length,
		hasSubmitKeyword: adsTextMatches(textBlob, config.submitKeywords, 12, 8) > 0,
		hasSearchLikeField: adsTextMatches(fieldText, config.searchHints, 10, 8) > 0,
		hasPasswordField: fieldEntries.some(({ summary }) => summary.type === 'password'),
		hasPositiveKeyword: adsTextMatches(textBlob, config.positiveKeywords, 8, 4) > 0,
		hasNegativeKeyword: adsTextMatches(textBlob, config.negativeKeywords, 8, 4) > 0,
		domDepth,
		textSample: textBlob.slice(0, 160),
	}
}
var getAdsSubmitButtonScore = (summary, config) => {
	const text = [summary.text, summary.ariaLabel, summary.title, summary.name, summary.id, summary.className].join(' ')
	return Math.max(summary.type === 'submit' ? 12 : 0, adsTextMatches(text, config.submitKeywords, 14, 9))
}
var getAdsButtonProximityScore = (button, fieldEntries) => {
	const fieldBounds = getAdsEntriesBounds(fieldEntries)
	const buttonRect = adsGetRect(button)
	if (!fieldBounds || !buttonRect) return 0
	const horizontalOverlap = Math.max(0, Math.min(fieldBounds.right, buttonRect.right) - Math.max(fieldBounds.left, buttonRect.left))
	const overlapRatio = horizontalOverlap / Math.max(1, Math.min(fieldBounds.width, buttonRect.width))
	const verticalGap = buttonRect.top - fieldBounds.bottom
	if (verticalGap >= -12 && verticalGap <= 360 && overlapRatio > 0.25) return 6
	if (Math.abs(verticalGap) <= 520) return 3
	return -6
}
var findAdsSubmitButton = (container, config, fieldEntries = [], root = null) => {
	let bestButton = null
	const localButtons = adsQueryAll(container, config.buttonSelector)
	const rootButtons = root && fieldEntries.length ? adsQueryAll(root, config.buttonSelector) : []
	const buttons = adsUniqueElements([...localButtons, ...rootButtons])
	for (const element of buttons) {
		const summary = summarizeAdsClickable(element)
		if (!summary.visible) continue
		const isLocal = adsElementContains(container, element)
		const isOwnedByForm = element.form && element.form === container
		if (!isLocal && !isOwnedByForm && !fieldEntries.length) continue
		let score = getAdsSubmitButtonScore(summary, config)
		if (isLocal || isOwnedByForm) score += 3
		else score += getAdsButtonProximityScore(element, fieldEntries)
		if (score < 8) continue
		if (score > 0 && (!bestButton || score > bestButton.score)) bestButton = { element, summary, score }
	}
	return bestButton || null
}
var getAdsFieldMatchScore = (summary, step) => {
	const text = [
		summary.name,
		summary.id,
		summary.placeholder,
		summary.ariaLabel,
		summary.autocomplete,
		summary.labelText,
		summary.nearbyText,
		summary.wrapperText,
		summary.dataText,
		summary.className,
	].join(' ')
	let score = adsTextMatches(text, ADS_FIELD_ALIASES[step] || [], 18, 10)
	if (step === 'age' && score > 0 && (summary.type === 'number' || summary.inputMode === 'numeric')) score += 4
	if (step === 'telephone' && (summary.type === 'tel' || summary.inputMode === 'tel')) score += score > 0 ? 8 : 16
	if (step === 'temporaryMail' && summary.type === 'email') score += score > 0 ? 8 : 16
	if (step === 'birthday' && ['date', 'month'].includes(summary.type)) score += score > 0 ? 8 : 12
	return score
}
var matchAdsFormFields = fieldEntries => {
	const used = new Set()
	const matchedFields = []
	ADS_FORM_STEPS.forEach(step => {
		let best = null
		fieldEntries.forEach((entry, entryIndex) => {
			if (used.has(entryIndex)) return
			const score = getAdsFieldMatchScore(entry.summary, step)
			if (score >= 8 && (!best || score > best.score)) best = { ...entry, step, entryIndex, score }
		})
		if (best) {
			used.add(best.entryIndex)
			matchedFields.push(best)
		}
	})
	return matchedFields.sort((left, right) => left.entryIndex - right.entryIndex)
}
var getAdsFormFingerprint = (element, fieldEntries, submitButton) =>
	adsNormalizeText(
		[
			element.tagName,
			element.id,
			element.className,
			fieldEntries
				.map(({ summary }) => [summary.type, summary.name, summary.id, summary.placeholder, summary.ariaLabel].join(':'))
				.join('|'),
			submitButton && [submitButton.summary.text, submitButton.summary.id, submitButton.summary.name].join(':'),
		].join('|'),
	)
var scoreAdsCandidate = (summary, formFields, submitButton) => {
	const matchedSteps = formFields.map(field => field.step)
	const primaryFieldCount = matchedSteps.filter(step => ADS_PRIMARY_FORM_STEPS.includes(step)).length
	const supportingFieldCount = matchedSteps.filter(step => ADS_SUPPORTING_FORM_STEPS.includes(step)).length
	const hasEnoughFieldSignal =
		formFields.length >= 2 || primaryFieldCount >= 1 || (summary.visibleFieldCount === 1 && summary.hasPositiveKeyword)
	if (!submitButton || !hasEnoughFieldSignal) {
		return { total: -10, reasons: [{ label: 'missing-submit-or-field-signal', score: -10 }] }
	}
	if (summary.hasPasswordField || (summary.hasSearchLikeField && formFields.length <= 1)) {
		return { total: -10, reasons: [{ label: 'unsafe-form-kind', score: -10 }] }
	}
	if (summary.hasNegativeKeyword && primaryFieldCount <= 1 && !summary.hasPositiveKeyword) {
		return { total: -10, reasons: [{ label: 'negative-form-context', score: -10 }] }
	}
	const reasons = []
	let total = 0
	const addScore = (score, label) => {
		total += score
		if (score) reasons.push({ label, score })
	}
	addScore(summary.tagName === 'form' ? 6 : 2, 'container-type')
	addScore(Math.min(formFields.length, 4) * 5, 'matched-fields')
	addScore(Math.min(primaryFieldCount, 2) * 6, 'primary-fields')
	addScore(Math.min(supportingFieldCount, 2) * 2, 'supporting-fields')
	addScore(summary.requiredFieldCount > 0 ? 2 : 0, 'required-fields')
	addScore(summary.visibleFieldCount >= 1 && summary.visibleFieldCount <= 6 ? 4 : 0, 'balanced-field-count')
	addScore(summary.hasPositiveKeyword ? 4 : 0, 'positive-keywords')
	addScore(summary.hasSubmitKeyword ? 4 : 0, 'submit-copy')
	addScore(submitButton.score >= 8 ? 6 : 3, 'submit-button')
	addScore(summary.visibleFieldCount > 8 ? -Math.min((summary.visibleFieldCount - 8) * 2, 12) : 0, 'too-many-fields')
	addScore(summary.visibleButtonCount > 6 ? -Math.min((summary.visibleButtonCount - 6) * 2, 8) : 0, 'too-many-buttons')
	addScore(summary.hasSearchLikeField ? -12 : 0, 'search-like')
	addScore(summary.hasPasswordField ? -16 : 0, 'password-field')
	addScore(summary.hasNegativeKeyword ? -10 : 0, 'negative-keywords')
	addScore(primaryFieldCount === 0 && supportingFieldCount === 0 ? -8 : 0, 'weak-field-semantics')
	return { total, reasons, matchedFieldCount: formFields.length, primaryFieldCount, supportingFieldCount }
}
function recognizeAdsLandingPage(options = {}) {
	const root = options.root || window.document
	if (!root) throw new Error('recognizeAdsLandingPage requires a DOM root')
	const config = { ...ADS_RECOGNITION_CONFIG, ...(options.overrides || {}) }
	const allFieldEntries = getAdsVisibleFields(root, config)
	const candidateContainers = getAdsCandidateContainers(root, allFieldEntries, config)
	const candidates = candidateContainers
		.map(element => {
			const fieldEntries = allFieldEntries.filter(({ element: fieldElement }) => adsElementContains(element, fieldElement))
			if (!fieldEntries.length) return null
			const summary = summarizeAdsCandidate(element, fieldEntries, config)
			const submitButton = findAdsSubmitButton(element, config, fieldEntries, root)
			const formFields = matchAdsFormFields(fieldEntries)
			if (!submitButton) return null
			const scoreDetails = scoreAdsCandidate(summary, formFields, submitButton)
			return scoreDetails.total > 0
				? {
						element,
						summary,
						fieldEntries,
						formFields,
						matchedFields: formFields,
						submitButton,
						fingerprint: getAdsFormFingerprint(element, fieldEntries, submitButton),
						score: scoreDetails.total,
						scoreDetails,
					}
				: null
		})
		.filter(Boolean)
		.sort((left, right) => right.score - left.score)
		.slice(0, config.maxCandidates)
	const fallbackTargets = {}
	const preferredTarget = candidates[0] ? { type: 'candidate', target: candidates[0] } : null
	return {
		candidates,
		bestCandidate: candidates[0] || null,
		pageState: null,
		fallbackTargets,
		preferredTarget,
		submitResult: null,
		config,
	}
}

var getAdEffectStateStore = () => {
	window.__adEffectFormState = window.__adEffectFormState || {}
	return window.__adEffectFormState
}
var getAdEffectStateKey = behaviorsId => behaviorsId || 'default'
var rememberAdEffectFormCandidate = (candidate, behaviorsId) => {
	if (!candidate || !candidate.fingerprint) return
	const store = getAdEffectStateStore()
	const stateKey = getAdEffectStateKey(behaviorsId)
	store[stateKey] = { ...(store[stateKey] || {}), fingerprint: candidate.fingerprint }
}
var findAdEffectFormCandidate = (recognition, behaviorsId) => {
	const candidates = recognition && recognition.candidates ? recognition.candidates : []
	if (!candidates.length) return null
	const state = getAdEffectStateStore()[getAdEffectStateKey(behaviorsId)]
	if (state && state.fingerprint) {
		const matched = candidates.find(candidate => candidate.fingerprint === state.fingerprint)
		if (matched) return matched
	}
	return candidates[0]
}
var calculateAgeByBirthday = birthday => {
	const birthdayText = String(birthday || '').trim()
	const birthdayMatch = birthdayText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
	const date = birthdayMatch
		? new Date(Number(birthdayMatch[3]), Number(birthdayMatch[1]) - 1, Number(birthdayMatch[2]))
		: new Date(birthdayText)
	if (Number.isNaN(date.getTime())) return ''
	const today = new Date()
	let age = today.getFullYear() - date.getFullYear()
	const monthDelta = today.getMonth() - date.getMonth()
	if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) age -= 1
	return age > 0 ? String(age) : ''
}
var normalizeAdEffectPerson = rawPerson => ({
	...rawPerson,
	age: rawPerson.age || calculateAgeByBirthday(rawPerson.birthday),
	fullName: rawPerson.fullName || '',
	telephone: rawPerson.telephone || '',
	temporaryMail: rawPerson.temporaryMail || '',
})
var getAdEffectFormDataUrl = countryCode => `${ADS_FORM_DATA_BASE_URL}${encodeURIComponent(countryCode || '')}`
var fetchAdEffectPerson = countryCode =>
	fetch(getAdEffectFormDataUrl(countryCode))
		.then(response => response.json())
		.then(result => {
			const list = result && Array.isArray(result.data) ? result.data : []
			if (!list.length) return null
			return normalizeAdEffectPerson(list[Math.floor(Math.random() * list.length)])
		})
var getAdEffectPerson = (behaviorsId, countryCode) => {
	const store = getAdEffectStateStore()
	const stateKey = getAdEffectStateKey(behaviorsId)
	const state = store[stateKey] || {}
	if (state.person) return Promise.resolve(state.person)
	return fetchAdEffectPerson(countryCode)
		.then(person => {
			state.person = person
			store[stateKey] = state
			return state.person
		})
		.catch(error => {
			state.person = null
			store[stateKey] = state
			return state.person
		})
}

var startAdExposureMonitor = selector => {
	const EXPOSURE_RATIO = 0.5
	const EXPOSURE_DURATION_MS = 1000
	const SCROLL_STOP_DELAY_MS = 200
	const ELEMENT_SEARCH_RETRY_DELAY_MS = 2000
	const MAX_ELEMENT_SEARCH_ATTEMPTS = 3
	const baseSelector = String(selector || '')
		.replace(/::(?:before|after|first-line|first-letter|placeholder|marker)/gi, '')
		.trim()
	if (!baseSelector || typeof window.IntersectionObserver !== 'function') return null

	const currentMonitor = window.__adExposureMonitor
	if (currentMonitor && !currentMonitor.stopped && currentMonitor.selector === baseSelector) {
		currentMonitor.refresh()
		return currentMonitor
	}
	if (currentMonitor && typeof currentMonitor.stop === 'function') currentMonitor.stop()

	const elementStateMap = new WeakMap()
	const elementStates = new Set()
	const listenerOptions = { capture: true, passive: true }
	const performanceNow = () => (window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now())
	let adSequence = 0
	let isScrolling = true
	let isPageVisible = document.visibilityState !== 'hidden'
	let lastScrollAt = performanceNow()
	let scrollStopTimer = null
	let refreshTimer = null
	let elementSearchRetryTimer = null
	let stopped = false
	const monitorSessionId = `exposure_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

	const hasExposureVisibleStyle = element => {
		let current = element
		while (current && current !== document.documentElement) {
			const style = window.getComputedStyle(current)
			if (style.display === 'none') return false
			if (style.visibility === 'hidden' || style.visibility === 'collapse') return false
			if (Number(style.opacity) <= 0) return false
			current = current.parentElement
		}
		return true
	}

	const clearExposureTimer = state => {
		if (state.timerId !== null) window.clearTimeout(state.timerId)
		state.timerId = null
		state.visibleStartedAt = null
		state.visibleStartedPerformanceAt = null
	}

	const canCountExposure = state =>
		!stopped &&
		!state.hasExposed &&
		!isScrolling &&
		isPageVisible &&
		state.element.isConnected &&
		state.isIntersecting &&
		state.intersectionRatio > EXPOSURE_RATIO &&
		hasExposureVisibleStyle(state.element)

	const reportExposure = state => {
		const exposedAt = Date.now()
		const duration = Math.max(0, performanceNow() - state.visibleStartedPerformanceAt)
		state.hasExposed = true
		state.exposedAt = exposedAt
		state.timerId = null
		const element = state.element
		const trackData = {
			action: 'exposure',
			event: 'qualified',
			isExposed: true,
			monitorSessionId,
			adId: state.adId,
			adBusinessId:
				element.getAttribute('data-ad-id') || element.getAttribute('data-ad-slot') || element.getAttribute('data-ad-unit') || '',
			elementId: element.id || '',
			tagName: String(element.tagName || '').toLowerCase(),
			className: adsNormalizeSpace(element.getAttribute('class') || ''),
			selector: baseSelector,
			intersectionRatio: Math.round(state.intersectionRatio * 10000) / 10000,
			staticVisibleStartedAt: state.visibleStartedAt,
			exposedAt,
			staticVisibleDurationMs: Math.round(duration),
		}
		try {
			JSBehavior.dotrack('20', JSON.stringify(trackData))
		} catch (error) {}
	}

	const validateExposureTimer = state => {
		state.timerId = null
		if (!canCountExposure(state)) {
			clearExposureTimer(state)
			return
		}
		const duration = performanceNow() - state.visibleStartedPerformanceAt
		if (duration >= EXPOSURE_DURATION_MS) {
			reportExposure(state)
			return
		}
		state.timerId = window.setTimeout(() => validateExposureTimer(state), EXPOSURE_DURATION_MS - duration)
	}

	const startExposureTimer = state => {
		if (!canCountExposure(state) || state.timerId !== null || state.visibleStartedPerformanceAt !== null) return
		state.visibleStartedAt = Date.now()
		state.visibleStartedPerformanceAt = performanceNow()
		state.timerId = window.setTimeout(() => validateExposureTimer(state), EXPOSURE_DURATION_MS)
	}

	const resetPendingExposureTimers = () => {
		elementStates.forEach(state => {
			if (!state.hasExposed) clearExposureTimer(state)
		})
	}

	const startVisibleExposureTimers = () => {
		if (stopped || isScrolling || !isPageVisible) return
		elementStates.forEach(startExposureTimer)
	}

	const finishScrolling = force => {
		if (stopped) return
		const idleDuration = performanceNow() - lastScrollAt
		if (!force && idleDuration < SCROLL_STOP_DELAY_MS) {
			scrollStopTimer = window.setTimeout(() => finishScrolling(false), SCROLL_STOP_DELAY_MS - idleDuration)
			return
		}
		if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer)
		scrollStopTimer = null
		isScrolling = false
		startVisibleExposureTimers()
	}

	const scheduleScrollStop = () => {
		if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer)
		scrollStopTimer = window.setTimeout(() => finishScrolling(false), SCROLL_STOP_DELAY_MS)
	}

	const handleScroll = () => {
		if (stopped) return
		lastScrollAt = performanceNow()
		isScrolling = true
		resetPendingExposureTimers()
		scheduleScrollStop()
	}

	const handleScrollEnd = () => {
		if (stopped) return
		lastScrollAt = performanceNow()
		finishScrolling(true)
	}

	const observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				const state = elementStateMap.get(entry.target)
				if (!state) return
				state.isIntersecting = entry.isIntersecting
				state.intersectionRatio = entry.intersectionRatio || 0
				if (!canCountExposure(state)) {
					if (!state.hasExposed) clearExposureTimer(state)
					return
				}
				startExposureTimer(state)
			})
		},
		{ root: null, rootMargin: '0px', threshold: [0, EXPOSURE_RATIO, 0.500001, 1] },
	)

	const observeElement = element => {
		if (!element || elementStateMap.has(element)) return
		const state = {
			adId: `ad_${++adSequence}`,
			element,
			intersectionRatio: 0,
			isIntersecting: false,
			visibleStartedAt: null,
			visibleStartedPerformanceAt: null,
			timerId: null,
			hasExposed: false,
			exposedAt: null,
		}
		elementStateMap.set(element, state)
		elementStates.add(state)
		observer.observe(element)
	}

	const refreshElements = () => {
		if (stopped) return 0
		let matchedElements = []
		try {
			matchedElements = Array.from(document.querySelectorAll(baseSelector))
		} catch (error) {
			return 0
		}
		if (matchedElements.length > 0 && elementSearchRetryTimer !== null) {
			window.clearTimeout(elementSearchRetryTimer)
			elementSearchRetryTimer = null
		}
		const matchedSet = new Set(matchedElements)
		matchedElements.forEach(observeElement)
		elementStates.forEach(state => {
			if (state.element.isConnected && matchedSet.has(state.element)) return
			clearExposureTimer(state)
			observer.unobserve(state.element)
			elementStateMap.delete(state.element)
			elementStates.delete(state)
		})
		startVisibleExposureTimers()
		return matchedElements.length
	}

	const findElementsWithRetry = (attempt = 1) => {
		if (stopped) return
		elementSearchRetryTimer = null
		const matchedElementCount = refreshElements()
		if (matchedElementCount > 0 || attempt >= MAX_ELEMENT_SEARCH_ATTEMPTS) return
		elementSearchRetryTimer = window.setTimeout(() => findElementsWithRetry(attempt + 1), ELEMENT_SEARCH_RETRY_DELAY_MS)
	}

	const startElementSearch = () => {
		if (elementSearchRetryTimer !== null) window.clearTimeout(elementSearchRetryTimer)
		elementSearchRetryTimer = null
		findElementsWithRetry()
	}

	const scheduleRefresh = () => {
		if (refreshTimer !== null) return
		refreshTimer = window.setTimeout(() => {
			refreshTimer = null
			refreshElements()
		}, 50)
	}

	const mutationObserver = new MutationObserver(scheduleRefresh)
	mutationObserver.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['id', 'class', 'style', 'hidden', 'data-ad-id', 'data-ad-slot', 'data-ad-unit'],
	})

	const handleVisibilityChange = () => {
		isPageVisible = document.visibilityState !== 'hidden'
		if (!isPageVisible) {
			isScrolling = true
			resetPendingExposureTimers()
			if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer)
			scrollStopTimer = null
			return
		}
		isScrolling = true
		lastScrollAt = performanceNow()
		resetPendingExposureTimers()
		scheduleScrollStop()
	}

	const stop = () => {
		if (stopped) return
		stopped = true
		monitor.stopped = true
		observer.disconnect()
		mutationObserver.disconnect()
		resetPendingExposureTimers()
		if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer)
		if (refreshTimer !== null) window.clearTimeout(refreshTimer)
		if (elementSearchRetryTimer !== null) window.clearTimeout(elementSearchRetryTimer)
		listenerBindings.forEach(([target, event, handler, options]) => target.removeEventListener(event, handler, options))
	}

	const listenerBindings = [
		[document, 'scroll', handleScroll, listenerOptions],
		[document, 'scrollend', handleScrollEnd, listenerOptions],
		[document, 'wheel', handleScroll, listenerOptions],
		[document, 'touchmove', handleScroll, listenerOptions],
		[document, 'visibilitychange', handleVisibilityChange],
		[window, 'pagehide', stop],
	]
	if (window.visualViewport) listenerBindings.push([window.visualViewport, 'scroll', handleScroll, { passive: true }])
	const monitor = {
		selector: baseSelector,
		monitorSessionId,
		stopped: false,
		refresh: startElementSearch,
		stop,
	}
	window.__adExposureMonitor = monitor
	listenerBindings.forEach(([target, event, handler, options]) => target.addEventListener(event, handler, options))
	startElementSearch()
	scheduleScrollStop()
	return monitor
}

var AdActionRuntime = (() => {
	const randomItem = list => list[Math.floor(Math.random() * list.length)]
	const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
	const normalizeAction = action =>
		String(action || '')
			.trim()
			.replace(/[\s_-]+/g, '')
			.toUpperCase()
	const isSlideEnabled = slide => slide === true || String(slide).toLowerCase() === 'true'
	const formatPoint = point => (point ? point.x + ',' + point.y : '')
	const isPointInViewport = (point, viewport) => point.x >= 0 && point.x <= viewport.maxX && point.y >= 0 && point.y <= viewport.maxY
	const track = (type, data) => JSBehavior.dotrack(type, JSON.stringify(data))
	const sendResult = (context, result) => {
		const {
			action = context.action.toLowerCase(),
			position = '',
			nextStep = '',
			slide = context.slide,
			pageFinish = context.pageFinish,
		} = result
		// ACTIONFAIL 的处理流程不变，客户端回报统一使用失败动作。
		const resultAction = context.action === 'ACTIONFAIL' ? context.failedAction.toLowerCase() : action
		if (context.resultFormat === 'json') {
			JSBehavior.jsResult(
				JSON.stringify({
					jskey: resultAction,
					value: position,
					step: nextStep,
					isScroll: String(isSlideEnabled(slide)),
					isJump: String(isSlideEnabled(pageFinish)),
					behaviorsId: context.behaviorsId,
				}),
			)
			return
		}
		JSBehavior.jsResult(resultAction, position, nextStep, slide, pageFinish, context.behaviorsId)
	}

	function createContext(originalAction, searchText = 'iphone', step = '', behaviorsId = '', countryCode = 'US', value = '', options = {}) {
		let config = {}
		try {
			config = JSON.parse(`{config}`)
		} catch (error) {}
		config.ADEFFECT = { pageFinish: false, slide: true }
		config.INTERSTITIALCLOSE = { pageFinish: false, slide: false }
		const clickAdSelector = config.CLICKAD && config.CLICKAD.selector
		config.EXPOSURE = config.EXPOSURE || {}
		config.EXPOSURE.selector = clickAdSelector || config.EXPOSURE.selector || null
		const action = normalizeAction(originalAction)
		const actionConfig = config[action]
		const slide = options.isScroll === undefined ? (actionConfig ? actionConfig.slide : '') : options.isScroll
		const pageFinish = options.isJump === undefined ? (actionConfig ? actionConfig.pageFinish : '') : options.isJump
		const width = window.innerWidth || document.documentElement.clientWidth
		const height = window.innerHeight || document.documentElement.clientHeight
		const viewport = { width, height, maxX: Math.max(0, width - 1), maxY: Math.max(0, height - 1) }
		return {
			originalAction,
			action,
			failedAction: action === 'ACTIONFAIL' ? normalizeAction(step) : '',
			actionConfig,
			config,
			slide,
			viewport,
			pageFinish,
			resultFormat: options.resultFormat,
			searchText,
			step,
			nowStep: step || '{step}',
			behaviorsId,
			countryCode,
			value,
			dom: createDomTools(viewport, slide),
		}
	}

	// 每次调用独立保存视口与坐标规则，保持原有 slide 的页面 Y 坐标协议。
	function createDomTools(viewport, defaultSlide) {
		const { height: viewportHeight, maxX: maxViewportX, maxY: maxViewportY } = viewport
		const getDocumentBounds = () => {
			const doc = document.documentElement
			const body = document.body
			return {
				width: Math.max(doc.scrollWidth || 0, body ? body.scrollWidth || 0 : 0, window.innerWidth || 0),
				height: Math.max(doc.scrollHeight || 0, body ? body.scrollHeight || 0 : 0, window.innerHeight || 0),
				scrollLeft: window.pageXOffset || doc.scrollLeft || 0,
				scrollTop: window.pageYOffset || doc.scrollTop || 0,
			}
		}

		const isElementInDocumentRange = rect => {
			const { width: docWidth, height: docHeight, scrollLeft, scrollTop } = getDocumentBounds()
			const pageLeft = rect.left + scrollLeft
			const pageRight = rect.right + scrollLeft
			const pageTop = rect.top + scrollTop
			const pageBottom = rect.bottom + scrollTop
			return pageRight > 0 && pageLeft < docWidth && pageBottom > 0 && pageTop < docHeight
		}

		const hasVisibleStyle = element => {
			let current = element
			while (current && current !== document.documentElement) {
				const style = window.getComputedStyle(current)
				if (style.display === 'none') return false
				if (style.visibility === 'hidden') return false
				if (Number(style.opacity) === 0) return false
				if (style.pointerEvents === 'none') return false
				current = current.parentElement
			}
			return true
		}

		const isElementClickable = element => {
			if (!element || !element.isConnected) return false
			if (element.disabled) return false
			if (!hasVisibleStyle(element)) return false

			const rect = element.getBoundingClientRect()
			if (rect.width <= 0 || rect.height <= 0) return false

			return isElementInDocumentRange(rect)
		}

		const pointHitsElement = (element, x, y) => {
			const topElement = document.elementFromPoint(x, y)
			if (!topElement) return false
			return topElement === element || element.contains(topElement)
		}

		const parsePseudoSelector = selector => {
			const match = selector.match(/(::(?:before|after|first-line|first-letter|placeholder|marker))$/i)
			if (match) {
				return { baseSelector: selector.slice(0, match.index).trim() || '*', pseudo: match[1] }
			}
			return { baseSelector: selector, pseudo: null }
		}

		const getPseudoElementRect = (element, pseudo) => {
			const style = window.getComputedStyle(element, pseudo)
			if (style.display === 'none' || style.content === 'none' || style.content === 'normal') return null
			const parentRect = element.getBoundingClientRect()
			const w = parseFloat(style.width)
			const h = parseFloat(style.height)
			const effectiveWidth = w > 0 ? w : parentRect.width
			const effectiveHeight = h > 0 ? h : parentRect.height
			if (effectiveWidth <= 0 || effectiveHeight <= 0) return null
			let top = parentRect.top
			let left = parentRect.left
			if (style.position === 'absolute' || style.position === 'fixed') {
				const t = parseFloat(style.top)
				const l = parseFloat(style.left)
				const b = parseFloat(style.bottom)
				const r = parseFloat(style.right)
				if (!isNaN(t)) top = parentRect.top + t
				else if (!isNaN(b)) top = parentRect.bottom - b - effectiveHeight
				if (!isNaN(l)) left = parentRect.left + l
				else if (!isNaN(r)) left = parentRect.right - r - effectiveWidth
			}
			return {
				left,
				top,
				right: left + effectiveWidth,
				bottom: top + effectiveHeight,
				width: effectiveWidth,
				height: effectiveHeight,
			}
		}

		const getCandidatePoints = (element, rectOverride, slide = defaultSlide) => {
			const rect = rectOverride || element.getBoundingClientRect()
			if (!isElementInDocumentRange(rect)) return []
			const canSlide = isSlideEnabled(slide)

			const innerLeft = rect.left + rect.width * 0.2
			const innerRight = rect.right - rect.width * 0.2
			const innerTop = rect.top + rect.height * 0.2
			const innerBottom = rect.bottom - rect.height * 0.2

			const pointLeft = clamp(innerLeft, 0, maxViewportX)
			const pointRight = clamp(innerRight, 0, maxViewportX)

			const pointTop = canSlide ? innerTop : clamp(innerTop, 0, maxViewportY)
			const pointBottom = canSlide ? innerBottom : clamp(innerBottom, 0, maxViewportY)
			const innerWidth = pointRight - pointLeft
			const innerHeight = pointBottom - pointTop
			if (innerWidth <= 0 || innerHeight <= 0) return []

			const points = []
			for (let i = 0; i < 13; i++) {
				points.push({
					x: pointLeft + Math.random() * innerWidth,
					y: pointTop + Math.random() * innerHeight,
				})
			}
			return points
		}

		const findClickablePoint = (element, rectOverride, slide = defaultSlide) => {
			const points = getCandidatePoints(element, rectOverride, slide)
			if (points.length === 0) return null
			const canSlide = isSlideEnabled(slide)

			for (let i = 0; i < points.length; i++) {
				const point = points[i]
				if (!isPointInViewport(point, viewport)) {
					if (canSlide) return point
					continue
				}
				if (pointHitsElement(element, point.x, point.y)) {
					return point
				}
			}
			return null
		}

		const getValidElementsWithPointBySelector = (selector, slide = defaultSlide) => {
			if (!selector) return []
			const { baseSelector, pseudo } = parsePseudoSelector(selector)
			const candidates = Array.from(document.querySelectorAll(baseSelector))
			if (pseudo) {
				return candidates
					.filter(el => el && document.body.contains(el) && hasVisibleStyle(el))
					.map(element => {
						const pseudoRect = getPseudoElementRect(element, pseudo)
						if (!pseudoRect) return null
						const point = findClickablePoint(element, pseudoRect, slide)
						return point ? { element, rect: pseudoRect, point } : null
					})
					.filter(Boolean)
			}
			return candidates
				.filter(isElementClickable)
				.map(element => {
					const rect = element.getBoundingClientRect()
					const point = findClickablePoint(element, rect, slide)
					return point ? { element, rect, point } : null
				})
				.filter(Boolean)
		}

		// 广告先按几何可达性入选，遮挡检测只作用于抽中的元素。
		const getAdTargets = (selector, slide = defaultSlide) => {
			if (!selector) return []
			const { baseSelector, pseudo } = parsePseudoSelector(selector)
			const { height: docHeight, scrollTop } = getDocumentBounds()
			return Array.from(document.querySelectorAll(baseSelector)).flatMap(element => {
				if (!element || !element.isConnected || element.disabled || !hasVisibleStyle(element)) return []
				const rect = pseudo ? getPseudoElementRect(element, pseudo) : element.getBoundingClientRect()
				if (!rect || rect.width <= 0 || rect.height <= 0 || !isElementInDocumentRange(rect)) return []
				let fixed = false
				for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
					if (window.getComputedStyle(node).position === 'fixed') fixed = true
				}
				const canScroll = isSlideEnabled(slide) && !fixed
				const left = Math.max(rect.left, 0)
				const right = Math.min(rect.right, maxViewportX)
				const top = Math.max(rect.top, canScroll ? -scrollTop : 0)
				const bottom = Math.min(rect.bottom, canScroll ? docHeight - 1 - scrollTop : maxViewportY)
				if (right <= left || bottom <= top) return []
				// 优先取元素中间区域；仅边缘可达时，使用可达的那一部分。
				const innerLeft = Math.max(left, rect.left + rect.width * 0.2)
				const innerRight = Math.min(right, rect.right - rect.width * 0.2)
				const innerTop = Math.max(top, rect.top + rect.height * 0.2)
				const innerBottom = Math.min(bottom, rect.bottom - rect.height * 0.2)
				return [{
					element,
					rect,
					bounds: {
						left: innerRight > innerLeft ? innerLeft : left,
						right: innerRight > innerLeft ? innerRight : right,
						top: innerBottom > innerTop ? innerTop : top,
						bottom: innerBottom > innerTop ? innerBottom : bottom,
					},
				}]
			})
		}

		const getAdPoint = (target, slide = defaultSlide) => {
			const { element, bounds } = target
			let fallback = null
			for (let i = 0; i < 13; i++) {
				const point = {
					x: bounds.left + Math.random() * (bounds.right - bounds.left),
					y: bounds.top + Math.random() * (bounds.bottom - bounds.top),
				}
				if (!fallback) fallback = point
				if (isPointInViewport(point, viewport) && pointHitsElement(element, point.x, point.y)) return { point, needsScroll: false }
				if (!isPointInViewport(point, viewport) && isSlideEnabled(slide)) return { point, needsScroll: true }
			}
			// 原生滚动沿用页面坐标协议，保留同一个目标交给客户端滚动/失败恢复。
			return { point: isSlideEnabled(slide) ? fallback : null, needsScroll: true }
		}

		const toPageCoordinate = (point, slide = defaultSlide) => {
			const { height: docHeight, scrollTop } = getDocumentBounds()
			if (!isSlideEnabled(slide)) {
				return {
					x: clamp(point.x, 0, maxViewportX),
					y: clamp(point.y, 0, maxViewportY),
				}
			}
			return {
				x: clamp(point.x, 0, maxViewportX),
				y: clamp(point.y + scrollTop, 0, Math.max(0, docHeight - 1)),
			}
		}

		const scrollToPageY = (pageY, callback) => {
			const { height: docHeight } = getDocumentBounds()
			const maxScrollTop = Math.max(0, docHeight - viewportHeight)
			const targetScrollTop = clamp(pageY - viewportHeight / 2, 0, maxScrollTop)
			const requestFrame = window.requestAnimationFrame || (handler => window.setTimeout(handler, 16))
			const startTime = Date.now()
			let lastScrollTop = getDocumentBounds().scrollTop
			let stableFrameCount = 0
			let finished = false

			const finish = () => {
				if (finished) return
				finished = true
				callback()
			}
			const waitForScrollEnd = () => {
				const currentScrollTop = getDocumentBounds().scrollTop
				if (Math.abs(currentScrollTop - lastScrollTop) < 1) stableFrameCount += 1
				else stableFrameCount = 0
				lastScrollTop = currentScrollTop

				const elapsed = Date.now() - startTime
				if ((elapsed >= 150 && stableFrameCount >= 5) || elapsed >= 2000) {
					finish()
					return
				}
				requestFrame(waitForScrollEnd)
			}

			try {
				window.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
			} catch (error) {
				window.scrollTo(0, targetScrollTop)
			}
			requestFrame(waitForScrollEnd)
		}

		return {
			findTargets: getValidElementsWithPointBySelector,
			findAdTargets: getAdTargets,
			findAdPoint: getAdPoint,
			findPoint: findClickablePoint,
			toCoordinate: toPageCoordinate,
			getDocumentBounds,
			scrollToPageY,
		}
	}

	const dispatchFieldChange = element => {
		element.dispatchEvent(new Event('input', { bubbles: true }))
		element.dispatchEvent(new Event('change', { bubbles: true }))
	}
	const typeTextLikeKeyboard = (inputElement, text) => {
		if (!inputElement) return
		const target = String(text == null ? '' : text)
		const setNativeValue = value => {
			const ownDescriptor = Object.getOwnPropertyDescriptor(inputElement, 'value')
			const prototype = Object.getPrototypeOf(inputElement)
			const prototypeDescriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')
			const setter =
				prototypeDescriptor && prototypeDescriptor.set && (!ownDescriptor || ownDescriptor.set !== prototypeDescriptor.set)
					? prototypeDescriptor.set
					: ownDescriptor && ownDescriptor.set
			if (setter) setter.call(inputElement, value)
			else inputElement.value = value
		}
		const dispatchInputEvent = data => {
			try {
				inputElement.dispatchEvent(
					new InputEvent('input', {
						data,
						inputType: data ? 'insertText' : 'deleteContentBackward',
						bubbles: true,
					}),
				)
			} catch (error) {
				inputElement.dispatchEvent(new Event('input', { bubbles: true }))
			}
		}
		inputElement.focus()
		setNativeValue('')
		dispatchInputEvent('')

		let currentValue = ''
		for (let i = 0; i < target.length; i++) {
			const ch = target[i]
			inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }))
			inputElement.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }))
			currentValue += ch
			setNativeValue(currentValue)
			dispatchInputEvent(ch)
			inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }))
		}
		inputElement.dispatchEvent(new Event('change', { bubbles: true }))
	}

	const getAdEffectFieldValue = (field, formPerson) => {
		const element = field && field.element
		const value = formPerson[field.step] == null ? '' : String(formPerson[field.step])
		if (field.step === 'birthday' && element && String(element.getAttribute('type') || '').toLowerCase() === 'date') {
			const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
			if (match) {
				const month = String(match[1]).padStart(2, '0')
				const day = String(match[2]).padStart(2, '0')
				return `${match[3]}-${month}-${day}`
			}
		}
		return value
	}
	const findAdEffectSelectOption = (element, field, formPerson) => {
		const options = Array.from(element.options || []).filter(option => !option.disabled)
		const preferredValues = [
			getAdEffectFieldValue(field, formPerson),
			field.step === 'state' ? formPerson.stateFull : '',
			field.step === 'gender' ? formPerson.gender : '',
			field.step === 'employmentStatus' ? formPerson.employmentStatus : '',
		]
			.map(adsNormalizeText)
			.filter(Boolean)
		const matched = options.find(option => {
			const text = adsNormalizeText([option.textContent, option.value].join(' '))
			return preferredValues.some(value => text === value || text.includes(value) || value.includes(text))
		})
		if (matched) return matched
		return options.find(option => adsNormalizeSpace(option.value || option.textContent)) || options[0] || null
	}
	const fillAdEffectFormField = (field, formPerson) => {
		if (!field) return
		const element = field.element
		const tagName = String(element && element.tagName ? element.tagName : '').toLowerCase()
		const inputType = String(element && element.getAttribute ? element.getAttribute('type') || '' : '').toLowerCase()
		if (element && String(element.tagName || '').toLowerCase() === 'select') {
			const option = findAdEffectSelectOption(element, field, formPerson)
			if (!option) return
			element.focus()
			element.value = option.value
			element.selectedIndex = Array.from(element.options || []).indexOf(option)
			dispatchFieldChange(element)
			return
		}
		if (inputType === 'checkbox' || inputType === 'radio') {
			element.focus()
			if (!element.checked) element.click()
			dispatchFieldChange(element)
			return
		}
		if (tagName === 'input' || tagName === 'textarea') {
			typeTextLikeKeyboard(element, getAdEffectFieldValue(field, formPerson))
		}
	}

	function getInterstitialCandidates(context, slide) {
		const config = context.config.INTERSTITIAL
		return config && config.selector ? context.dom.findTargets(config.selector, slide) : []
	}

	function detectInterstitial(context) {
		if (['CHECKPAGE', 'INTERSTITIAL', 'INTERSTITIALCLOSE', 'EXPOSURE'].includes(context.action)) return null
		const elements = getInterstitialCandidates(context, context.slide)
		return elements.length ? { type: 'interstitial', elements } : null
	}

	function detectHighBanner(context) {
		const config = context.config.BANNER
		if (
			!['CLICKAD', 'SECONDPAGE', 'ACTIONFAIL'].includes(context.action) ||
			!config ||
			!config.selector ||
			!(config.slide === false || String(config.slide).toLowerCase() === 'false')
		)
			return null
		const elements = context.dom
			.findTargets(config.selector, config.slide)
			.map(({ element }) => ({ element, rect: element.getBoundingClientRect() }))
			.filter(({ rect }) => rect.height > 360)
		if (!elements.length) return null
		const selected = elements.reduce((largest, current) => (current.rect.height > largest.rect.height ? current : largest))
		return { type: 'highBanner', elements, selected }
	}

	function detectAdBlocker(context) {
		return detectInterstitial(context) || detectHighBanner(context)
	}

	function getBannerPosition(context, { element, rect }) {
		const parent = element.parentElement
		const parentRect = parent ? parent.getBoundingClientRect() : rect
		const parentStyle = parent ? window.getComputedStyle(parent) : null
		const hasTop = parentStyle && parentStyle.top !== 'auto'
		const hasBottom = parentStyle && parentStyle.bottom !== 'auto'
		if (hasTop && !hasBottom) return 'top'
		if (hasBottom && !hasTop) return 'bottom'
		return Math.abs(parentRect.top) <= Math.abs(context.viewport.height - parentRect.bottom) ? 'top' : 'bottom'
	}

	function handleInterstitialBlocker(context, blocker) {
		sendResult(context, {
			action: context.action.toLowerCase(),
			position: '',
			nextStep: 'irregularinter',
			slide: '',
			pageFinish: '',
		})
		return true
	}

	function handleHighBannerBlocker(context, blocker) {
		const { element, rect } = blocker.selected
		const bannerPosition = getBannerPosition(context, blocker.selected)
		const point =
			bannerPosition === 'top'
				? { x: rect.left + 30 + Math.random(), y: rect.bottom + 15 + Math.random() }
				: { x: rect.left + 30 + Math.random(), y: rect.top - 15 + Math.random() }
		const inViewport = isPointInViewport(point, context.viewport)
		const selectedElementId = element.id || 'null'
		const position = inViewport ? `${point.x},${point.y},${selectedElementId}` : `,,${selectedElementId}`
		track(26, {
			action: context.action.toLowerCase(),
			foundElementCount: blocker.elements.length,
			elementIds: blocker.elements.map(item => item.element.id).filter(Boolean),
			selectedElementId,
			bannerHeight: rect.height,
			bannerPosition,
			position,
		})
		sendResult(context, {
			action: context.originalAction,
			position,
			nextStep: context.action === 'ACTIONFAIL' ? context.step : context.originalAction,
			slide: false,
			pageFinish: false,
		})
		return true
	}

	// 多个业务位置共用此入口；已检测时可传入结果，避免重复查找和随机选点。
	function handleAdBlocker(context, blocker = detectAdBlocker(context)) {
		if (!blocker) return false
		if (blocker.type === 'interstitial') return handleInterstitialBlocker(context, blocker)
		if (blocker.type === 'highBanner') return handleHighBannerBlocker(context, blocker)
		return false
	}

	const recognizeForm = () => (typeof recognizeAdsLandingPage === 'function' ? recognizeAdsLandingPage() : null)
	const collectElementStats = targets => ({
		foundElementCount: targets.length,
		elementIds: targets.map(({ element }) => element.id).filter(Boolean),
	})
	const selectTarget = (context, targets) => {
		if (!targets.length) return { element: null, elementId: '', point: null, position: '' }
		const { element, point } = randomItem(targets)
		const coordinate = context.dom.toCoordinate(point, context.slide)
		return { element, elementId: element.id || '', point: coordinate, position: formatPoint(coordinate) }
	}
	const getElementPosition = (context, element) => {
		const point = context.dom.findPoint(element, null, context.slide)
		return point ? formatPoint(context.dom.toCoordinate(point, context.slide)) : ''
	}

	function handleAdEffect(context) {
		const candidate = findAdEffectFormCandidate(recognizeForm(), context.behaviorsId)
		if (!candidate) return
		rememberAdEffectFormCandidate(candidate, context.behaviorsId)
		getAdEffectPerson(context.behaviorsId, context.countryCode).then(person => {
			const steps = candidate.formFields.map(field => field.step)
			const step = context.nowStep === '{step}' ? '' : context.nowStep
			const index = steps.indexOf(step)
			const fieldForStep = stepName => candidate.formFields.find(field => field.step === stepName)
			if (person && index >= 0) fillAdEffectFormField(fieldForStep(steps[index]), person)
			const nextStep = index >= 0 ? steps[index + 1] : steps[0]
			const target = nextStep ? fieldForStep(nextStep).element : candidate.submitButton.element
			sendResult(context, {
				action: 'adeffect',
				position: getElementPosition(context, target),
				nextStep: nextStep || '',
			})
		})
	}

	function handleCheckPage(context) {
		startAdExposureMonitor((context.config.EXPOSURE || {}).selector)
		const matchedActions = []
		const actions = []
		const allElements = new Set()
		const detailedActions = new Set(['clickad', 'interstitial', 'banner'])
		Object.keys(context.config).forEach(key => {
			const config = context.config[key]
			const action = key.toLowerCase()
			const selectors = [config && config.selector, config && config.inputSelector, config && config.buttonSelector].filter(Boolean)
			const findTargets = action === 'clickad' ? context.dom.findAdTargets : context.dom.findTargets
			const targets = selectors.flatMap(selector => findTargets(selector, config && config.slide))
			const uniqueTargets = Array.from(new Map(targets.map(item => [item.element, item])).values())
			uniqueTargets.forEach(({ element }) => allElements.add(element))
			const stats = { action, foundElementCount: uniqueTargets.length }
			if (detailedActions.has(action)) {
				stats.elementIds = collectElementStats(uniqueTargets).elementIds
				const canSlide = isSlideEnabled(config && config.slide)
				const { scrollLeft, scrollTop } = context.dom.getDocumentBounds()
				stats.elements = uniqueTargets.map(({ element }) => {
					const rect = element.getBoundingClientRect()
					return {
						elementId: element.id || '',
						width: rect.width,
						height: rect.height,
						left: rect.left + (canSlide ? scrollLeft : 0),
						top: rect.top + (canSlide ? scrollTop : 0),
					}
				})
			}
			actions.push(stats)
			if (uniqueTargets.length) matchedActions.push(action)
		})
		const recognition = recognizeForm()
		if (recognition && recognition.candidates && recognition.candidates.length && !matchedActions.includes('adeffect')) {
			matchedActions.push('adeffect')
		}
		try {
			track('1', { foundElementCount: allElements.size, matchedActions, actions })
		} catch (error) {}
		return { position: matchedActions.join(','), slide: '', pageFinish: '' }
	}

	function handleSearch(context) {
		const config = context.config.SEARCH || {}
		const input = selectTarget(context, context.dom.findTargets(config.inputSelector, context.slide))
		let selected = { element: null, elementId: '', position: '' }
		let nextStep = ''
		if (context.nowStep === '{step}') {
			selected = input
			nextStep = '{searchButton}'
		} else if (context.nowStep === '{searchButton}' && input.element) {
			typeTextLikeKeyboard(input.element, context.searchText)
			selected = selectTarget(context, context.dom.findTargets(config.buttonSelector, context.slide))
		}
		track('5', {
			nowStep: context.nowStep,
			elementId: selected.elementId,
			className: selected.element ? adsNormalizeSpace(selected.element.className) : '',
			position: selected.position,
		})
		return { position: selected.position, nextStep }
	}

	function handleInterstitialClose(context) {
		// 与原版一致：此动作要求配置 INTERSTITIAL；关闭坐标由客户端执行。
		const selector = context.config.INTERSTITIAL.selector
		const targets = selector ? getInterstitialCandidates(context, false) : []
		let position = ''
		if (targets.length) {
			const padding = 2
			const x = window.innerWidth - 24 - 46 + padding + Math.random() * (46 - padding * 2)
			const y = 24 + padding + Math.random() * (24 - padding * 2)
			position = formatPoint({
				x,
				y,
			})
			track('2', { action: context.action.toLowerCase(), position })
		}
		return { position, slide: false, pageFinish: false }
	}

	const clickTrackTypes = { CLICKAD: '3', BANNER: '6', SECONDPAGE: '9', ASSOCIATIONSEARCH: '8', INTERSTITIAL: '7' }
	function handleClick(context) {
		const config = context.actionConfig
		const isAd = context.action === 'CLICKAD'
		const targets = (isAd ? context.dom.findAdTargets : context.dom.findTargets)(config && config.selector, context.slide)
		let shouldSkipClick = false
		if (isAd && targets.length) {
			const hasClickRate = config.clickrate !== undefined && config.clickrate !== null
			const clickRate = Number(config.clickrate)
			const randomNum = Math.floor(Math.random() * 100)
			shouldSkipClick = hasClickRate && randomNum > clickRate * targets.length
		}
		let adTarget = null
		let needsScroll = false
		let selected
		if (isAd && !shouldSkipClick && targets.length) {
			adTarget = randomItem(targets)
			const candidate = context.dom.findAdPoint(adTarget, context.slide)
			needsScroll = candidate.needsScroll
			const point = candidate.point ? context.dom.toCoordinate(candidate.point, context.slide) : null
			selected = { element: adTarget.element, elementId: adTarget.element.id || '', point, position: formatPoint(point) }
		} else {
			selected = selectTarget(context, isAd || shouldSkipClick ? [] : targets)
		}
		const result = { position: selected.point ? selected.position + ',' + (selected.elementId || 'null') : '' }
		const stats = {
			action: context.action.toLowerCase(),
			...collectElementStats(targets),
			selectedElementId: selected.elementId,
			position: selected.position,
		}
		if (isAd) stats.shouldSkipClick = shouldSkipClick
		// 选择结果立即且只上报一次，不依赖滚动完成；最终点击坐标由 jsResult 返回。
		track(clickTrackTypes[context.action] || '4', stats)
		if (isAd && config && isSlideEnabled(context.slide) && isSlideEnabled(config.jsSlide) && selected.point) {
			const { scrollTop } = context.dom.getDocumentBounds()
			const y = selected.point.y
			if (needsScroll || y < scrollTop || y > scrollTop + context.viewport.maxY) {
				context.dom.scrollToPageY(y, () => {
					// 滚动后重新检查同一元素；失败时回报空坐标，不改抽其他广告。
					const refreshed = context.dom.findAdTargets(config.selector, false).find(target => target.element === adTarget.element)
					const candidate = refreshed ? context.dom.findAdPoint(refreshed, false).point : null
					const point = candidate ? context.dom.toCoordinate(candidate, context.slide) : null
					result.position = point ? formatPoint(point) + ',' + (selected.elementId || 'null') : ''
					sendResult(context, result)
				})
				return
			}
		}
		return result
	}

	const parsePagePoint = value => {
		if (typeof value !== 'string') return null
		const parts = value.split(',')
		if (parts.length < 2 || parts.length > 3 || !parts[0].trim() || !parts[1].trim()) return null
		// 第三项为可选元素 ID（也可能是 "null"），只解析前两项并保留完整原值。
		const [x, y] = parts.slice(0, 2).map(Number)
		return Number.isFinite(x) && Number.isFinite(y) ? { x, y, position: value } : null
	}

	function handleActionFail(context) {
		const nextStep = context.failedAction === 'ADEFFECT' ? 'adeffect' : ''
		const point = parsePagePoint(context.value)
		if (!point) return { nextStep }
		const { slide = '', pageFinish = '' } = context.config[context.failedAction] || {}
		context.dom.scrollToPageY(point.y, () => {
			sendResult(context, {
				position: point.position,
				nextStep,
				// value 沿用页面坐标，滚动后保持原值及精度。
				slide,
				pageFinish,
			})
		})
	}

	const handlers = {
		ADEFFECT: handleAdEffect,
		CHECKPAGE: handleCheckPage,
		SEARCH: handleSearch,
		INTERSTITIALCLOSE: handleInterstitialClose,
		ACTIONFAIL: handleActionFail,
	}
	function run(context) {
		if (handleAdBlocker(context)) return
		// EXPOSURE 沿用原通用动作路径；监控仍由 CHECKPAGE 启动。
		const result = (handlers[context.action] || handleClick)(context)
		if (result) sendResult(context, result)
	}

	// context 对应一次动作调用；后续独立动作应重新创建，以刷新视口和配置。
	return { createContext, detectAdBlocker, handleAdBlocker, run }
})()

function allACtion(jskey, searchText = 'iphone', step = '', behaviorsId = '', countryCode = 'US', value = '', options = {}) {
	AdActionRuntime.run(AdActionRuntime.createContext(jskey, searchText, step, behaviorsId, countryCode, value, options))
}

function allACtionJSON(jsonString) {
	if (typeof jsonString !== 'string') return
	let params
	try {
		params = JSON.parse(jsonString)
	} catch (error) {
		return
	}
	if (!params || typeof params !== 'object' || Array.isArray(params)) return
	if (typeof params.jskey !== 'string' || !params.jskey.replace(/[\s_-]+/g, '')) return
	const options = { resultFormat: 'json' }
	for (const key of ['isScroll', 'isJump']) {
		if (params[key] === undefined) continue
		const value = typeof params[key] === 'string' ? params[key].trim().toLowerCase() : params[key]
		if (value !== true && value !== false && value !== 'true' && value !== 'false') return
		options[key] = value === true || value === 'true'
	}
	return allACtion(params.jskey, params.searchText, params.step, params.behaviorsId, params.countryCode, params.value, options)
}

// ==============================
// 客户端调用说明
// ==============================
// jskey - 操作类型，必填项，值为以下之一：
// checkpage - 检测可执行动作 1
// agreement - 欧洲协议弹窗  4
// clickad - 点击广告     3
// banner - 锚定广告    6
// search - 二次搜索   5
// secondpage - 二级页面   9
// associationsearch - 关联搜索   8
// interstitial - 插屏广告        7
// interstitialclose - 插屏广告关闭  2
// adeffect - 转化
// exposure - 监听广告曝光
// actionfail - 动作失败后处理广告遮挡；step 为失败的 jskey，回报 jskey 使用其归一化小写值。
// 先沿用插屏检测，再检测高 banner；actionfail 的高 banner 检测不限制失败动作 step。
// 插屏回报 nextStep=irregularinter；高 banner 回报 nextStep 使用原 step；无遮挡滚动后回报 nextStep=""。
// 无遮挡且失败动作为 adeffect 时，回报 nextStep="adeffect"。
// 第五个参数 countryCode 保持不变；第六个参数 value 为原页面坐标 "x,y" 或 "x,y,id"，id 也可为 "null"。
// 无遮挡时先滚动使 y 进入视口，再完整原样回报 value；slide/pageFinish 读取失败动作配置，缺失时为空字符串。
// 缺失或无效坐标回报空坐标结果。
// JSON 入口：allACtionJSON(jsonString)，接收 jskey/searchText/step/behaviorsId/countryCode/value/isScroll/isJump。
// isScroll/isJump 可传布尔值或 "true"/"false"，未传时沿用动作配置；具体处理分支的回报标记优先。
// JSON 调用的 jsResult 只接收一个 JSON 字符串，字段为 jskey/value/step/isScroll/isJump/behaviorsId。
// JSON 回报中的 isScroll/isJump 始终为字符串 "true"/"false"；原入口仍回报六个位置参数。
//
// 注意：下面调用示例中的 {xxx} 是客户端替换占位符，必须原样保留。

// ==============================
// 以下是调用代码
// 此处保留旧客户端模板；JSON 客户端将下方调用替换为 allACtionJSON(jsonString)，只执行所选入口一次。
// ==============================
;(function allACtionWithParams() {
	if (typeof allACtion === 'undefined') {
		return 'allACtion_undefined'
	} else {
		allACtion('{jskey}', '{searchText}', '{step}', '{behaviorsId}', '{countryCode}', '{value}')
	}
})()

// 本地测试通过独立测试入口注入 JSBehavior，避免覆盖客户端桥接。
