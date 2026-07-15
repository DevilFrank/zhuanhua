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
if (typeof window !== 'undefined' && !window.JSBehavior) {
	window.JSBehavior = {
		jsResult: (...args) => console.log('jsResult', ...args),
		dotrack: (...args) => console.log('dotrack', ...args),
	}
}

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
	const addReason = (score, label) => {
		if (score) reasons.push({ label, score })
	}
	let total = summary.tagName === 'form' ? 6 : 2
	addReason(summary.tagName === 'form' ? 6 : 2, 'container-type')
	const matchedFieldScore = Math.min(formFields.length, 4) * 5
	total += matchedFieldScore
	addReason(matchedFieldScore, 'matched-fields')
	const primaryFieldScore = Math.min(primaryFieldCount, 2) * 6
	total += primaryFieldScore
	addReason(primaryFieldScore, 'primary-fields')
	const supportingFieldScore = Math.min(supportingFieldCount, 2) * 2
	total += supportingFieldScore
	addReason(supportingFieldScore, 'supporting-fields')
	const requiredFieldScore = summary.requiredFieldCount > 0 ? 2 : 0
	total += requiredFieldScore
	addReason(requiredFieldScore, 'required-fields')
	const balancedFieldScore = summary.visibleFieldCount >= 1 && summary.visibleFieldCount <= 6 ? 4 : 0
	total += balancedFieldScore
	addReason(balancedFieldScore, 'balanced-field-count')
	const positiveKeywordScore = summary.hasPositiveKeyword ? 4 : 0
	total += positiveKeywordScore
	addReason(positiveKeywordScore, 'positive-keywords')
	const submitCopyScore = summary.hasSubmitKeyword ? 4 : 0
	total += submitCopyScore
	addReason(submitCopyScore, 'submit-copy')
	const submitButtonScore = submitButton.score >= 8 ? 6 : 3
	total += submitButtonScore
	addReason(submitButtonScore, 'submit-button')
	const tooManyFieldsPenalty = summary.visibleFieldCount > 8 ? -Math.min((summary.visibleFieldCount - 8) * 2, 12) : 0
	total += tooManyFieldsPenalty
	addReason(tooManyFieldsPenalty, 'too-many-fields')
	const tooManyButtonsPenalty = summary.visibleButtonCount > 6 ? -Math.min((summary.visibleButtonCount - 6) * 2, 8) : 0
	total += tooManyButtonsPenalty
	addReason(tooManyButtonsPenalty, 'too-many-buttons')
	const searchLikePenalty = summary.hasSearchLikeField ? -12 : 0
	total += searchLikePenalty
	addReason(searchLikePenalty, 'search-like')
	const passwordPenalty = summary.hasPasswordField ? -16 : 0
	total += passwordPenalty
	addReason(passwordPenalty, 'password-field')
	const negativeKeywordPenalty = summary.hasNegativeKeyword ? -10 : 0
	total += negativeKeywordPenalty
	addReason(negativeKeywordPenalty, 'negative-keywords')
	const weakFieldPenalty = primaryFieldCount === 0 && supportingFieldCount === 0 ? -8 : 0
	total += weakFieldPenalty
	addReason(weakFieldPenalty, 'weak-field-semantics')
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

function allACtion(jskey, searchText = 'iphone', step = '', behaviorsId = '', countryCode = 'US') {
	const nowStep = step || '{step}'
	let nextStep = ''
	const ACTION_CONFIG = `{
    "ADEFFECT": {
      "pageFinish": false,
      "slide": true
    },
    "INTERSTITIALCLOSE": {
      "pageFinish": true,
      "slide": false
	    }
	  }`
	const ACTIONSJSON = `{config}`
	let ACTION_KEY = {}
	try {
		ACTION_KEY = JSON.parse(ACTIONSJSON)
	} catch (error) {}
	ACTION_KEY['ADEFFECT'] = JSON.parse(ACTION_CONFIG)['ADEFFECT']
	ACTION_KEY['INTERSTITIALCLOSE'] = JSON.parse(ACTION_CONFIG)['INTERSTITIALCLOSE']
	const normalizeAction = String(jskey || '')
		.trim()
		.replace(/[\s_-]+/g, '')
		.toUpperCase()

	const viewportWidth = window.innerWidth || document.documentElement.clientWidth
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight
	const maxViewportX = Math.max(0, viewportWidth - 1)
	const maxViewportY = Math.max(0, viewportHeight - 1)
	const currentAction = ACTION_KEY[normalizeAction]
	const currentSlide = currentAction ? currentAction.slide : ''
	const currentPageFinish = currentAction ? currentAction.pageFinish : ''

	const randomItem = list => list[Math.floor(Math.random() * list.length)]
	const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
	const isCurrentSlide = () => currentSlide === true || String(currentSlide).toLowerCase() === 'true'

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

	const getCandidatePoints = (element, rectOverride) => {
		const rect = rectOverride || element.getBoundingClientRect()
		if (!isElementInDocumentRange(rect)) return []

		const innerLeft = rect.left + rect.width * 0.2
		const innerRight = rect.right - rect.width * 0.2
		const innerTop = rect.top + rect.height * 0.2
		const innerBottom = rect.bottom - rect.height * 0.2

		const pointLeft = clamp(innerLeft, 0, maxViewportX)
		const pointRight = clamp(innerRight, 0, maxViewportX)

		const pointTop = isCurrentSlide() ? innerTop : clamp(innerTop, 0, maxViewportY)
		const pointBottom = isCurrentSlide() ? innerBottom : clamp(innerBottom, 0, maxViewportY)
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

	const findClickablePoint = (element, rectOverride) => {
		const points = getCandidatePoints(element, rectOverride)
		if (points.length === 0) return null
		const isPointInViewport = point => point.x >= 0 && point.x <= maxViewportX && point.y >= 0 && point.y <= maxViewportY

		for (let i = 0; i < points.length; i++) {
			const point = points[i]
			if (!isPointInViewport(point)) {
				if (isCurrentSlide()) return point
				continue
			}
			if (pointHitsElement(element, point.x, point.y)) {
				return point
			}
		}
		return null
	}

	const getElementSnapshot = element => {
		const rect = element.getBoundingClientRect()
		const style = window.getComputedStyle(element)
		return {
			tagName: element.tagName ? element.tagName.toLowerCase() : '',
			id: element.id || '',
			className: adsNormalizeSpace(element.className),
			name: element.getAttribute('name') || '',
			type: element.getAttribute('type') || '',
			role: element.getAttribute('role') || '',
			ariaLabel: element.getAttribute('aria-label') || '',
			title: element.getAttribute('title') || '',
			href: element.getAttribute('href') || '',
			src: element.getAttribute('src') || '',
			text: adsNormalizeSpace(element.textContent || element.value || '').slice(0, 200),
			rect: {
				left: rect.left,
				top: rect.top,
				right: rect.right,
				bottom: rect.bottom,
				width: rect.width,
				height: rect.height,
			},
			style: {
				display: style.display,
				visibility: style.visibility,
				opacity: style.opacity,
				position: style.position,
				pointerEvents: style.pointerEvents,
			},
			isConnected: element.isConnected,
			disabled: Boolean(element.disabled),
			visibleStyle: hasVisibleStyle(element),
			documentRange: isElementInDocumentRange(rect),
		}
	}

	const getValidElementSnapshot = item => {
		const coordinate = toPageCoordinate(item.point)
		return {
			element: item.elementSnapshot || getElementSnapshot(item.element),
			point: item.point,
			coordinate,
			position: `${coordinate.x},${coordinate.y}`,
		}
	}

	const getValidElementsWithPointBySelector = selector => {
		if (!selector) return []
		const { baseSelector, pseudo } = parsePseudoSelector(selector)
		const candidates = Array.from(document.querySelectorAll(baseSelector))
		const candidatesSnapshot = candidates.map((element, index) => ({
			index,
			...getElementSnapshot(element),
		}))
		const trackData = {
			selector,
			baseSelector,
			pseudo,
			candidateCount: candidates.length,
			candidates: candidatesSnapshot,
		}
		JSBehavior.dotrack('10', JSON.stringify(trackData))
		if (pseudo) {
			return candidates
				.filter(el => el && document.body.contains(el) && hasVisibleStyle(el))
				.map(element => {
					const pseudoRect = getPseudoElementRect(element, pseudo)
					if (!pseudoRect) return null
					const point = findClickablePoint(element, pseudoRect)
					return point ? { element, point, elementSnapshot: getElementSnapshot(element) } : null
				})
				.filter(Boolean)
		}
		return candidates
			.filter(isElementClickable)
			.map(element => {
				const point = findClickablePoint(element)
				return point ? { element, point, elementSnapshot: getElementSnapshot(element) } : null
			})
			.filter(Boolean)
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

	const toPageCoordinate = point => {
		const { height: docHeight, scrollTop } = getDocumentBounds()
		if (!isCurrentSlide()) {
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

	let reportKey = ''
	let reportPosition = ''
	const getAdEffectRecognition = () => (typeof recognizeAdsLandingPage === 'function' ? recognizeAdsLandingPage() : null)
	const hasAdEffectTarget = recognition => Boolean(recognition && recognition.candidates && recognition.candidates.length > 0)
	const getAdEffectElementName = element =>
		adsNormalizeSpace(
			[
				element && element.getAttribute && element.getAttribute('name'),
				element && element.id,
				element && element.getAttribute && element.getAttribute('aria-label'),
				element && element.getAttribute && element.getAttribute('title'),
				element && element.className,
				element && element.tagName,
			].find(Boolean) || '',
		)
	const getAdEffectElementContent = element =>
		adsNormalizeSpace((element && (element.textContent || element.value || (element.getAttribute && element.getAttribute('href')))) || '')
	const getAdEffectTrackInfo = recognition => {
		if (!recognition) return null
		const formCandidate =
			recognition.bestCandidate || (recognition.candidates && recognition.candidates.length > 0 ? recognition.candidates[0] : null)
		if (formCandidate && formCandidate.element) {
			return {
				type: '表单',
				element: formCandidate.element,
			}
		}
		return null
	}
	const reportAdEffectTrack = (recognition, trackType) => {
		const trackInfo = getAdEffectTrackInfo(recognition)
		if (!trackInfo || !trackInfo.type || !trackInfo.element) return
		const screenWidth = window.screen.width || 0
		const screenHeight = window.screen.height || 0
		const data = JSON.stringify({
			type: trackInfo.type,
			elementName: getAdEffectElementName(trackInfo.element),
			elementContent: getAdEffectElementContent(trackInfo.element),
			screenResolution: `${screenWidth}x${screenHeight}`,
		})
		try {
			JSBehavior.dotrack(trackType, data)
		} catch (error) {}
	}
	const getPointPosition = element => {
		const point = findClickablePoint(element)
		if (!point) return ''
		const coordinate = toPageCoordinate(point)
		return `${coordinate.x},${coordinate.y}`
	}
	const reportAdEffect = (position = '', adEffectNextStep = '') => {
		JSBehavior.jsResult('adeffect', position, adEffectNextStep, true, false, behaviorsId)
	}
	const getAdEffectFormField = (candidate, stepName) =>
		candidate && candidate.formFields ? candidate.formFields.find(field => field.step === stepName) : null
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
			element.dispatchEvent(new Event('input', { bubbles: true }))
			element.dispatchEvent(new Event('change', { bubbles: true }))
			return
		}
		if (inputType === 'checkbox' || inputType === 'radio') {
			element.focus()
			if (!element.checked) element.click()
			element.dispatchEvent(new Event('input', { bubbles: true }))
			element.dispatchEvent(new Event('change', { bubbles: true }))
			return
		}
		if (tagName === 'input' || tagName === 'textarea') {
			typeTextLikeKeyboard(element, getAdEffectFieldValue(field, formPerson))
		}
	}

	const shouldSkipInterstitialGuard =
		normalizeAction === 'CHECKPAGE' || normalizeAction === 'INTERSTITIAL' || normalizeAction === 'INTERSTITIALCLOSE'
	if (!shouldSkipInterstitialGuard && ACTION_KEY.INTERSTITIAL && ACTION_KEY.INTERSTITIAL.selector) {
		const interstitialElements = getValidElementsWithPointBySelector(ACTION_KEY.INTERSTITIAL.selector)
		if (interstitialElements.length > 0) {
			JSBehavior.jsResult(normalizeAction.toLowerCase(), '', 'irregularinter', '', '', behaviorsId)
			return
		}
	}

	if (normalizeAction === 'ADEFFECT') {
		const recognition = getAdEffectRecognition()
		const formCandidate = findAdEffectFormCandidate(recognition, behaviorsId)

		if (formCandidate) {
			rememberAdEffectFormCandidate(formCandidate, behaviorsId)
			getAdEffectPerson(behaviorsId, countryCode).then(formPerson => {
				const formSteps = formCandidate.formFields.map(field => field.step)
				const adEffectStep = nowStep === '{step}' ? '' : nowStep
				const currentStepIndex = formSteps.indexOf(adEffectStep)
				if (formPerson && currentStepIndex >= 0) {
					fillAdEffectFormField(getAdEffectFormField(formCandidate, formSteps[currentStepIndex]), formPerson)
				}

				const nextFormStep = currentStepIndex >= 0 ? formSteps[currentStepIndex + 1] : formSteps[0]
				if (nextFormStep) {
					reportAdEffect(getPointPosition(getAdEffectFormField(formCandidate, nextFormStep).element), nextFormStep)
					return
				}

				reportAdEffectTrack({ bestCandidate: formCandidate }, '4')
				reportAdEffect(getPointPosition(formCandidate.submitButton.element), '')
			})
			return
		}
		return
	} else if (normalizeAction === 'CHECKPAGE') {
		const matchedActionKeys = []
		Object.keys(ACTION_KEY).forEach(actionKey => {
			const actionConfig = ACTION_KEY[actionKey]
			const selectors = [
				actionConfig && actionConfig.selector,
				actionConfig && actionConfig.inputSelector,
				actionConfig && actionConfig.buttonSelector,
			].filter(Boolean)
			const validElements = selectors.flatMap(selector => getValidElementsWithPointBySelector(selector))
			if (validElements.length > 0) {
				matchedActionKeys.push(actionKey.toLowerCase())
			}
		})
		const adEffectRecognition = getAdEffectRecognition()
		if (hasAdEffectTarget(adEffectRecognition)) {
			if (!matchedActionKeys.includes('adeffect')) matchedActionKeys.push('adeffect')
			reportAdEffectTrack(adEffectRecognition, '5')
		}
		reportKey = matchedActionKeys.join(',')
	} else if (normalizeAction === 'SEARCH') {
		const searchConfig = ACTION_KEY.SEARCH || {}
		const inputElements = getValidElementsWithPointBySelector(searchConfig.inputSelector)
		const inputData = inputElements.length > 0 ? randomItem(inputElements) : null
		if (nowStep === '{step}') {
			if (inputData) {
				const inputCoordinate = toPageCoordinate(inputData.point)
				reportPosition = `${inputCoordinate.x},${inputCoordinate.y}`
			}
			nextStep = '{searchButton}'
		} else if (nowStep === '{searchButton}') {
			if (inputData) {
				typeTextLikeKeyboard(inputData.element, searchText)
				const buttonElements = getValidElementsWithPointBySelector(searchConfig.buttonSelector)
				if (buttonElements.length > 0) {
					const buttonData = randomItem(buttonElements)
					const buttonCoordinate = toPageCoordinate(buttonData.point)
					reportPosition = `${buttonCoordinate.x},${buttonCoordinate.y}`
				}
			}
		}
	} else if (normalizeAction === 'INTERSTITIALCLOSE') {
		const x = window.screen.width * 0.88 + Math.floor(Math.random() * window.screen.width * 0.1)
		const y = window.screen.height * 0.01 + Math.floor(Math.random() * window.screen.height * 0.03)
		reportPosition = `${x},${y}`
		const trackData = {
			normalizeAction,
			reportPosition,
		}
		JSBehavior.dotrack('11', JSON.stringify(trackData))
	} else if (normalizeAction === 'CLICKAD') {
		const selector = currentAction && currentAction.selector
		if (selector) {
			const validElementsWithPoint = getValidElementsWithPointBySelector(selector)
			const validElementCount = validElementsWithPoint.length
			if (validElementCount > 0) {
				const hasClickRate = currentAction.clickrate !== undefined && currentAction.clickrate !== null
				const clickRate = Number(currentAction.clickrate)
				const randomNum = Math.floor(Math.random() * 100)
				console.log('clickRate', clickRate, 'randomNum', randomNum, 'validElementCount', validElementCount)
				const shouldSkipClick = hasClickRate && randomNum > clickRate * validElementCount
				if (!shouldSkipClick) {
					const randomData = randomItem(validElementsWithPoint)
					const randomCoordinate = toPageCoordinate(randomData.point)
					const validElementsWithPointSnapshot = validElementsWithPoint.map((item, index) => ({
						index,
						...getValidElementSnapshot(item),
					}))
					const randomDataSnapshot = getValidElementSnapshot(randomData)
					reportPosition = `${randomCoordinate.x},${randomCoordinate.y},${randomDataSnapshot.element.id ? randomDataSnapshot.element.id : 'null'}`
					const trackData = {
						normalizeAction,
						selector,
						validElementCount,
						validElementsWithPoint: validElementsWithPointSnapshot,
						randomElementWithPoint: randomDataSnapshot,
					}
					JSBehavior.dotrack('11', JSON.stringify(trackData))
				}
			}
		}
	} else {
		const selector = currentAction && currentAction.selector
		if (selector) {
			const validElementsWithPoint = getValidElementsWithPointBySelector(selector)
			const validElementCount = validElementsWithPoint.length
			if (validElementCount > 0) {
				const randomData = randomItem(validElementsWithPoint)
				const randomCoordinate = toPageCoordinate(randomData.point)
				const validElementsWithPointSnapshot = validElementsWithPoint.map((item, index) => ({
					index,
					...getValidElementSnapshot(item),
				}))
				const randomDataSnapshot = getValidElementSnapshot(randomData)
				reportPosition = `${randomCoordinate.x},${randomCoordinate.y},${randomDataSnapshot.element.id ? randomDataSnapshot.element.id : 'null'}`
				const trackData = {
					normalizeAction,
					selector,
					validElementCount,
					validElementsWithPoint: validElementsWithPointSnapshot,
					randomElementWithPoint: randomDataSnapshot,
				}
				JSBehavior.dotrack('11', JSON.stringify(trackData))
			}
		}
	}

	reportClick(reportKey, reportPosition)

	function reportClick(key = '', position = '') {
		const jskey = normalizeAction.toLowerCase()
		if (jskey === 'checkpage') {
			JSBehavior.jsResult(jskey, key, nextStep, '', '', behaviorsId)
		} else {
			JSBehavior.jsResult(key || jskey, position, nextStep, currentSlide, currentPageFinish, behaviorsId)
		}
	}
}

// ==============================
// 客户端调用说明
// ==============================
// jskey - 操作类型，必填项，值为以下之一：
// checkpage - 检测可执行动作
// agreement - 欧洲协议弹窗
// clickad - 点击广告
// search - 二次搜索
// secondpage - 二级页面
// associationsearch - 关联搜索
// interstitial - 插屏广告
// interstitialclose - 插屏广告关闭
// adeffect - 转化
// exposure - 监听广告曝光
//
// 注意：下面调用示例中的 {xxx} 是客户端替换占位符，必须原样保留。

// ==============================
// 以下是调用代码
// ==============================
;(function allACtionWithParams() {
	if (typeof allACtion === 'undefined') {
		return 'allACtion_undefined'
	} else {
		allACtion('{jskey}', '{searchText}', '{step}', '{behaviorsId}', '{countryCode}')
	}
})()

// =============================
// 以下是本地测试用代码
// ==============================
window.JSBehavior = {
	jsResult: (...args) => console.log('jsResult', ...args),
	dotrack: (...args) => console.log('dotrack', ...args),
}
