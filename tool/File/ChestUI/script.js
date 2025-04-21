document.addEventListener('DOMContentLoaded', () => {
    const functionNameInput = document.getElementById('function-name');
    const chestGrid = document.getElementById('chest-grid');
    const formSizeSelect = document.getElementById('form-size');
    const formTitleInput = document.getElementById('form-title');
    const gridInstruction = document.getElementById('grid-instruction');
    const toolEditButton = document.getElementById('tool-edit');
    const toolSelectButton = document.getElementById('tool-select');
    const selectionControls = document.getElementById('selection-controls');
    const clearSelectionButton = document.getElementById('clear-selection-button');
    const editPatternButton = document.getElementById('edit-pattern-button');
    const selectionCountSpan = document.getElementById('selection-count');
    const clearIndividualButton = document.getElementById('clear-individual-button');
    const clearPatternMembershipButton = document.getElementById('clear-pattern-membership-button');
    const slotEditor = document.getElementById('slot-editor');
    const slotIndexDisplay = document.getElementById('slot-index-display');
    const itemNameInput = document.getElementById('slot-item-name');
    const itemDescTextarea = document.getElementById('slot-item-desc');
    const textureInput = document.getElementById('slot-texture');
    const stackSizeInput = document.getElementById('slot-stack-size');
    const durabilityInput = document.getElementById('slot-durability');
    const enchantedCheckbox = document.getElementById('slot-enchanted');
    const saveSlotButton = document.getElementById('save-slot-button');
    const clearSlotButton = document.getElementById('clear-slot-button');
    const cancelSlotButton = document.getElementById('cancel-slot-button');
    const patternEditor = document.getElementById('pattern-editor');
    const patternSlotCountDisplay = document.getElementById('pattern-slot-count');
    const patternKeyCharInput = document.getElementById('pattern-key-char');
    const patternItemNameInput = document.getElementById('pattern-item-name');
    const patternItemDescTextarea = document.getElementById('pattern-item-desc');
    const patternTextureInput = document.getElementById('pattern-texture');
    const patternStackSizeInput = document.getElementById('pattern-stack-size');
    const patternDurabilityInput = document.getElementById('pattern-durability');
    const patternEnchantedCheckbox = document.getElementById('pattern-enchanted');
    const savePatternButton = document.getElementById('save-pattern-button');
    const clearPatternFromSelectedButton = document.getElementById('clear-pattern-from-selected-button');
    const cancelPatternButton = document.getElementById('cancel-pattern-button');
    const generateCodeButton = document.getElementById('generate-code-button');
    const outputCodeTextarea = document.getElementById('output-code');
    const overlay = document.getElementById('overlay');

    const importCodeButton = document.getElementById('import-code-button');
    const importModal = document.getElementById('import-modal');
    const importCodeArea = document.getElementById('import-code-area');
    const confirmImportButton = document.getElementById('confirm-import-button');
    const cancelImportButton = document.getElementById('cancel-import-button');

    let currentTool = 'edit';
    let currentEditingSlotIndex = -1;
    let slotData = {};
    let patternConfig = null;
    let selectedSlots = new Set();
    let isDragging = false;
    let wasDragging = false;

    const sizes = { small: 27, large: 54 };

    function parseJsStringLiteral(str) {
        str = str.trim();
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            str = str.slice(1, -1);
            str = str.replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\n/g, '\n')
                .replace(/\\\\/g, '\\');
            return str;
        }
        console.warn("Could not parse string literal:", str);
        return str;
    }

    function parseJsStringArray(arrStr) {
        arrStr = arrStr.trim();
        if (arrStr.startsWith('[') && arrStr.endsWith(']')) {
            const content = arrStr.slice(1, -1).trim();
            if (!content) return [];
            const elements = [];
            let currentElement = '';
            let inString = null;
            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                if (!inString && (char === '"' || char === "'")) {
                    inString = char;
                } else if (inString === char) {
                    inString = null;
                }

                if (char === ',' && !inString) {
                    elements.push(parseJsStringLiteral(currentElement.trim()));
                    currentElement = '';
                } else {
                    currentElement += char;
                }
            }
            elements.push(parseJsStringLiteral(currentElement.trim()));
            return elements.filter(el => el !== undefined && el !== null);
        }
        console.warn("Could not parse string array:", arrStr);
        return [];
    }


    function setTool(newTool) {
        currentTool = newTool;
        toolEditButton.classList.toggle('active', newTool === 'edit');
        toolSelectButton.classList.toggle('active', newTool === 'select');
        chestGrid.className = '';
        chestGrid.classList.add(formSizeSelect.value === 'large' ? 'grid-large' : 'grid-small');
        chestGrid.classList.add(newTool === 'edit' ? 'tool-edit-mode' : 'tool-select-mode');

        if (newTool === 'edit') {
            gridInstruction.textContent = "Current Tool: Edit - Click a slot to edit individually.";
            selectionControls.style.display = 'none';
            clearMultiSelection();
            closePatternEditor();
        } else {
            gridInstruction.textContent = "Current Tool: Select - Click or drag to select multiple slots.";
            selectionControls.style.display = 'block';
            closeSlotEditor();
        }
        updateSelectionButtons();
    }

    function initializeGrid(sizeKey) {
        const slotCount = sizes[sizeKey];
        chestGrid.innerHTML = '';
        slotData = {};
        patternConfig = null;
        clearMultiSelection();

        chestGrid.className = 'grid-' + (sizeKey === 'large' ? 'large' : 'small');

        for (let i = 0; i < slotCount; i++) {
            const slot = document.createElement('div');
            slot.classList.add('slot');
            slot.dataset.slotIndex = i;
            slot.textContent = i;

            slot.addEventListener('mousedown', (e) => {
                if (currentTool === 'edit') {
                    openSlotEditor(i);
                } else {
                    isDragging = true;
                    wasDragging = false;
                    if (!e.shiftKey) {
                        if (!selectedSlots.has(i) || selectedSlots.size > 1) {
                            clearMultiSelection();
                        }
                        toggleSlotSelection(i);
                    } else {
                        toggleSlotSelection(i);
                    }
                    e.preventDefault();
                }
            });

            slot.addEventListener('mouseover', () => {
                if (currentTool === 'select' && isDragging) {
                    wasDragging = true;
                    if (!selectedSlots.has(i)) {
                        selectedSlots.add(i);
                        slot.classList.add('selected');
                        updateSelectionButtons();
                    }
                }
            });

            chestGrid.appendChild(slot);
        }

        document.addEventListener('mouseup', () => {
            if (isDragging && currentTool === 'select') {
                isDragging = false;
                updateSelectionButtons();
            }
        });

        chestGrid.classList.add(currentTool === 'edit' ? 'tool-edit-mode' : 'tool-select-mode');
        updateAllSlotVisuals();
    }

    function toggleSlotSelection(index) {
        const slotElement = chestGrid.querySelector(`.slot[data-slot-index='${index}']`);
        if (!slotElement) return;
        if (selectedSlots.has(index)) {
            if (!isDragging && !wasDragging && selectedSlots.size === 1) {
                // Keep selected on simple click
            } else {
                selectedSlots.delete(index);
                slotElement.classList.remove('selected');
            }
        } else {
            selectedSlots.add(index);
            slotElement.classList.add('selected');
        }
        updateSelectionButtons();
    }

    function clearMultiSelection() {
        selectedSlots.forEach(index => {
            const slotElement = chestGrid.querySelector(`.slot[data-slot-index='${index}']`);
            slotElement?.classList.remove('selected');
        });
        selectedSlots.clear();
        updateSelectionButtons();
    }

    function updateSelectionButtons() {
        const count = selectedSlots.size;
        selectionCountSpan.textContent = count;

        if (currentTool === 'select') {
            const hasSelection = count > 0;
            selectionControls.style.display = 'block';
            clearSelectionButton.disabled = !hasSelection;
            editPatternButton.disabled = !hasSelection;
            clearIndividualButton.disabled = !hasSelection;
            clearPatternMembershipButton.disabled = !hasSelection;

            if (patternEditor.style.display === 'block') {
                patternSlotCountDisplay.textContent = count;
                savePatternButton.disabled = count === 0;
                clearPatternFromSelectedButton.disabled = count === 0;
            }
        } else {
            selectionControls.style.display = 'none';
            if (patternEditor.style.display === 'block') {
                closePatternEditor();
            }
        }
    }

    function clearIndividualSettingsInSelection() {
        if (currentTool !== 'select' || selectedSlots.size === 0) return;
        let changed = false;
        selectedSlots.forEach(index => {
            if (slotData[index]) {
                delete slotData[index];
                changed = true;
                updateSlotVisual(index);
            }
        });
        if (changed) {
            generateCode();
        }
        clearMultiSelection();
    }

    function removePatternMembershipFromSelection() {
        if (currentTool !== 'select' || selectedSlots.size === 0 || !patternConfig) return;
        let changed = false;
        selectedSlots.forEach(index => {
            if (patternConfig.patternSlots.delete(index)) {
                changed = true;
                updateSlotVisual(index);
            }
        });
        if (changed) {
            if (patternConfig.patternSlots.size === 0) {
                patternConfig = null;
            }
            generateCode();
        }
        clearMultiSelection();
    }

    function showOverlay(show) { overlay.style.display = show ? 'block' : 'none'; }

    function openSlotEditor(index) {
        if (currentTool !== 'edit') return;
        closePatternEditor();
        closeImportModal();

        currentEditingSlotIndex = index;
        slotIndexDisplay.textContent = index;
        const data = slotData[index];

        itemNameInput.value = data?.itemName || '';
        itemDescTextarea.value = data?.itemDesc ? data.itemDesc.join('\n') : '';
        textureInput.value = data?.texture || '';
        stackSizeInput.value = data?.stackSize ?? 1;
        durabilityInput.value = data?.durability ?? 0;
        enchantedCheckbox.checked = data?.enchanted || false;

        slotEditor.style.display = 'block';
        showOverlay(true);
    }

    function closeSlotEditor() {
        if (slotEditor.style.display === 'none') return;
        slotEditor.style.display = 'none';
        currentEditingSlotIndex = -1;
        showOverlay(false);
    }

    function saveSlotData() {
        if (currentEditingSlotIndex === -1) return;

        const descLines = itemDescTextarea.value.split('\n').map(line => line.trimEnd()).filter(line => line);
        const textureValue = textureInput.value.trim();
        const itemNameValue = itemNameInput.value.trim();

        if (!textureValue) {
            alert("Texture field cannot be empty for a configured slot.");
            textureInput.focus();
            return;
        }

        slotData[currentEditingSlotIndex] = {
            itemName: itemNameValue,
            itemDesc: descLines,
            texture: textureValue,
            stackSize: parseInt(stackSizeInput.value, 10) || 1,
            durability: parseInt(durabilityInput.value, 10) || 0,
            enchanted: enchantedCheckbox.checked
        };

        updateSlotVisual(currentEditingSlotIndex);
        closeSlotEditor();
        generateCode();
    }

    function clearThisSlotData() {
        if (currentEditingSlotIndex !== -1) {
            delete slotData[currentEditingSlotIndex];
            updateSlotVisual(currentEditingSlotIndex);
        }
        closeSlotEditor();
        generateCode();
    }

    function openPatternEditor() {
        if (currentTool !== 'select' || selectedSlots.size === 0) {
            alert("Switch to Select Tool and select one or more slots first.");
            return;
        }
        closeSlotEditor();
        closeImportModal();

        patternSlotCountDisplay.textContent = selectedSlots.size;
        savePatternButton.disabled = false;
        clearPatternFromSelectedButton.disabled = false;

        if (patternConfig) {
            patternKeyCharInput.value = patternConfig.keyChar;
            const data = patternConfig.data;
            patternItemNameInput.value = data.itemName || '';
            patternItemDescTextarea.value = data.itemDesc ? data.itemDesc.join('\n') : '';
            patternTextureInput.value = data.texture || '';
            patternStackSizeInput.value = data.stackAmount ?? 1;
            patternDurabilityInput.value = data.durability ?? 0;
            patternEnchantedCheckbox.checked = data.enchanted || false;
        } else {
            patternKeyCharInput.value = 'x';
            patternItemNameInput.value = '';
            patternItemDescTextarea.value = '';
            patternTextureInput.value = '';
            patternStackSizeInput.value = 1;
            patternDurabilityInput.value = 0;
            patternEnchantedCheckbox.checked = false;
        }

        patternEditor.style.display = 'block';
        showOverlay(true);
    }

    function closePatternEditor() {
        if (patternEditor.style.display === 'none') return;
        patternEditor.style.display = 'none';
        showOverlay(false);
    }

    function applyPatternToSelected() {
        if (currentTool !== 'select' || selectedSlots.size === 0) return;

        const keyChar = patternKeyCharInput.value.trim() || ' ';
        const textureValue = patternTextureInput.value.trim();
        const itemNameValue = patternItemNameInput.value.trim();
        const descLines = patternItemDescTextarea.value.split('\n').map(line => line.trimEnd()).filter(line => line);

        if (!textureValue) {
            alert("Texture field cannot be empty for a pattern.");
            patternTextureInput.focus();
            return;
        }
        if (keyChar.length !== 1) {
            alert("Pattern Key Character must be a single character.");
            patternKeyCharInput.focus();
            return;
        }

        patternConfig = {
            keyChar: keyChar,
            patternSlots: new Set(selectedSlots),
            data: {
                itemName: itemNameValue,
                itemDesc: descLines,
                texture: textureValue,
                stackAmount: parseInt(patternStackSizeInput.value, 10) || 1,
                durability: parseInt(patternDurabilityInput.value, 10) || 0,
                enchanted: patternEnchantedCheckbox.checked
            }
        };

        updateAllSlotVisuals();
        closePatternEditor();
        generateCode();
    }


    function clearPatternConfigForSelected() {
        if (confirm("This will clear the entire pattern definition (key, item data, and associated slots). Are you sure?")) {
            patternConfig = null;
            updateAllSlotVisuals();
            closePatternEditor();
            generateCode();
        }
    }

    function updateSlotVisual(index) {
        const slotElement = chestGrid.querySelector(`.slot[data-slot-index='${index}']`);
        if (!slotElement) return;

        const isPatternMember = patternConfig && patternConfig.patternSlots.has(index);
        const isIndividuallyConfigured = !!slotData[index];

        slotElement.classList.toggle('pattern-member', isPatternMember && !isIndividuallyConfigured);
        slotElement.classList.toggle('configured', isIndividuallyConfigured);

        let displayText = `${index}`;
        if (isIndividuallyConfigured) {
            const data = slotData[index];
            displayText = data.itemName || data.texture?.split('/').pop()?.split('.')[0] || `Slot ${index}`;
        } else if (isPatternMember) {
            const pData = patternConfig.data;
            displayText = pData.itemName || pData.texture?.split('/').pop()?.split('.')[0] || patternConfig.keyChar;
        }

        slotElement.textContent = displayText.length > 8 ? displayText.substring(0, 7) + '…' : displayText;
        slotElement.title = `Slot ${index}` + (isIndividuallyConfigured ? ` (Item: ${slotData[index].itemName || 'N/A'})` : '') + (isPatternMember ? ` (Pattern: '${patternConfig.keyChar}')` : '');
    }

    function updateAllSlotVisuals() {
        const allSlots = chestGrid.querySelectorAll('.slot');
        allSlots.forEach(slot => {
            updateSlotVisual(parseInt(slot.dataset.slotIndex, 10));
            slot.classList.toggle('selected', selectedSlots.has(parseInt(slot.dataset.slotIndex, 10)));
        });
    }

    function generateCode() {
        const functionName = functionNameInput.value.trim() || 'generatedChestMenu';
        const sizeKey = formSizeSelect.value;
        const slotCount = sizes[sizeKey];
        const title = formTitleInput.value;
        const rowCount = slotCount / 9;
        const escapeString = (str) => JSON.stringify(str);

        let code = `import { Player } from '@minecraft/server';\n`;
        code += `import { ChestFormData } from '@minecraft/server-ui';\n\n`;
        code += `function ${functionName}(player: Player): void {\n`;
        code += `    const form = new ChestFormData('${sizeKey}')\n`;
        code += `        .title(${escapeString(title)})`;

        if (patternConfig && patternConfig.patternSlots.size > 0) {
            code += `\n        .pattern(\n`;
            code += `            [\n`;
            for (let i = 0; i < rowCount; i++) {
                let rowString = '';
                for (let j = 0; j < 9; j++) {
                    const slotIndex = i * 9 + j;
                    rowString += (patternConfig.patternSlots.has(slotIndex) && !slotData[slotIndex]) ? patternConfig.keyChar : ' ';
                }
                code += `                ${escapeString(rowString)}${i === rowCount - 1 ? '' : ','}\n`;
            }
            code += `            ],\n`;
            code += `            {\n`;
            const pData = patternConfig.data;
            const pDescArray = `[${pData.itemDesc.map(escapeString).join(', ')}]`;
            code += `                ${escapeString(patternConfig.keyChar)}: {\n`;
            code += `                    itemName: ${escapeString(pData.itemName)},\n`;
            code += `                    itemDesc: ${pDescArray},\n`;
            code += `                    texture: ${escapeString(pData.texture)},\n`;
            code += `                    stackAmount: ${pData.stackAmount},\n`;
            code += `                    durability: ${pData.durability},\n`;
            code += `                    enchanted: ${pData.enchanted}\n`;
            code += `                }\n`;
            code += `            }\n`;
            code += `        )`;
        } else {
            code += `;`;
        }

        const individualSlotIndices = Object.keys(slotData).map(Number).sort((a, b) => a - b);

        individualSlotIndices.forEach(index => {
            const data = slotData[index];
            if (!data || !data.texture) return;
            const itemDescArrayString = `[${data.itemDesc.map(escapeString).join(', ')}]`;

            if (code.trim().endsWith(')')) {
                code += `\n    form.button(${index}, ${escapeString(data.itemName)}, ${itemDescArrayString}, ${escapeString(data.texture)}, ${data.stackSize}, ${data.durability}, ${data.enchanted})`;
            } else {
                code = code.trim().replace(/;$/, '');
                code += `\n    form.button(${index}, ${escapeString(data.itemName)}, ${itemDescArrayString}, ${escapeString(data.texture)}, ${data.stackSize}, ${data.durability}, ${data.enchanted})`;
            }
        });

        if (individualSlotIndices.length > 0 || patternConfig) {
            code += `;`;
        }

        code += `\n\n    form.show(player).then(response => {\n`;
        code += `        if (response.canceled || response.selection === undefined) {\n`;
        code += `           console.log("Form canceled or selection undefined.");\n`;
        code += `           return;\n`;
        code += `        }\n\n`;
        code += `        const slotIndex = response.selection;\n`;
        code += `        console.log(\`Player clicked slot: \${slotIndex}\`);\n\n`;
        code += `        switch(slotIndex) {\n`;

        individualSlotIndices.forEach(index => {
            const data = slotData[index];
            code += `            case ${index}:\n`;
            code += `                player.sendMessage("You clicked: ${data.itemName || `Slot ${index}`}");\n`;
            code += `                break;\n`;
        });

        code += `            default:\n`;
        code += `                player.sendMessage(\`Clicked on background slot \${slotIndex}\`);\n`;
        code += `                break;\n`
        code += `        }\n`
        code += `    }).catch(error => {\n`;
        code += `       console.error(\`Error showing form ${functionName}: \${error}\`);\n`;
        code += `    });\n`;
        code += `}\n`;

        outputCodeTextarea.value = code;
    }

    function openImportModal() {
        closeSlotEditor();
        closePatternEditor();
        importCodeArea.value = '';
        importModal.style.display = 'block';
        showOverlay(true);
    }

    function closeImportModal() {
        importModal.style.display = 'none';
        showOverlay(false);
    }

    function parseAndApplyImportedCode() {
        const codeToParse = importCodeArea.value;
        if (!codeToParse.trim()) {
            alert("Import area is empty.");
            return;
        }

        try {
            const funcNameMatch = codeToParse.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
            const importedFuncName = funcNameMatch ? funcNameMatch[1] : 'importedFunction';

            const sizeMatch = codeToParse.match(/new\s+ChestFormData\s*\(\s*['"](small|large)['"]\s*\)/);
            const importedSize = sizeMatch ? sizeMatch[1] : 'large';

            const titleMatch = codeToParse.match(/\.title\s*\(\s*(.*?)\s*\)/);
            const importedTitle = titleMatch ? parseJsStringLiteral(titleMatch[1]) : 'Imported Menu';

            let importedPatternConfig = null;
            const patternBlockMatch = codeToParse.match(/\.pattern\s*\(\s*\[([\s\S]*?)\]\s*,\s*\{([\s\S]*?)\}\s*\)/);
            if (patternBlockMatch) {
                const patternArrayStr = patternBlockMatch[1];
                const patternObjectStr = patternBlockMatch[2];

                const patternRows = [];
                const rowRegex = /(['"](.*?)['"])/g;
                let rowMatch;
                while ((rowMatch = rowRegex.exec(patternArrayStr)) !== null) {
                    patternRows.push(rowMatch[2]);
                }

                const keyDataRegex = /(['"](.?)['"])\s*:\s*\{([\s\S]*?)\}/;
                const keyDataMatch = patternObjectStr.match(keyDataRegex);

                if (keyDataMatch && patternRows.length > 0) {
                    const patternKey = keyDataMatch[2];
                    const patternDataStr = keyDataMatch[3];

                    const itemNameMatch = patternDataStr.match(/itemName\s*:\s*(.*?)(?:,|$)/);
                    const itemDescMatch = patternDataStr.match(/itemDesc\s*:\s*(\[.*?\])(?:,|$)/s);
                    const textureMatch = patternDataStr.match(/texture\s*:\s*(.*?)(?:,|$)/);
                    const stackAmountMatch = patternDataStr.match(/(?:stackAmount|stackSize)\s*:\s*(\d+)/);
                    const durabilityMatch = patternDataStr.match(/durability\s*:\s*(\d+)/);
                    const enchantedMatch = patternDataStr.match(/enchanted\s*:\s*(true|false)/);

                    const pData = {
                        itemName: itemNameMatch ? parseJsStringLiteral(itemNameMatch[1].trim()) : '',
                        itemDesc: itemDescMatch ? parseJsStringArray(itemDescMatch[1].trim()) : [],
                        texture: textureMatch ? parseJsStringLiteral(textureMatch[1].trim()) : '',
                        stackAmount: stackAmountMatch ? parseInt(stackAmountMatch[1], 10) : 1,
                        durability: durabilityMatch ? parseInt(durabilityMatch[1], 10) : 0,
                        enchanted: enchantedMatch ? (enchantedMatch[1] === 'true') : false
                    };

                    const pSlots = new Set();
                    const expectedRows = sizes[importedSize] / 9;
                    if (patternRows.length === expectedRows) {
                        patternRows.forEach((row, rowIndex) => {
                            for (let colIndex = 0; colIndex < 9; colIndex++) {
                                if (colIndex < row.length && row[colIndex] === patternKey) {
                                    pSlots.add(rowIndex * 9 + colIndex);
                                }
                            }
                        });

                        if (pData.texture && patternKey && pSlots.size > 0) {
                            importedPatternConfig = {
                                keyChar: patternKey,
                                patternSlots: pSlots,
                                data: pData
                            };
                        } else {
                            console.warn("Pattern parsed but key, texture, or slots are missing/invalid.");
                        }
                    } else {
                        console.warn(`Pattern rows found (${patternRows.length}) don't match expected rows for size ${importedSize} (${expectedRows}).`);
                    }
                } else {
                    console.warn("Could not parse pattern key/data block from pattern object string:", patternObjectStr);
                }
            }

            const importedSlotData = {};
            const buttonRegex = /\.button\s*\(\s*(\d+)\s*,\s*(.*?)\s*,\s*(\[.*?\])\s*,\s*(.*?)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(true|false)\s*\)/g;
            let buttonMatch;
            while ((buttonMatch = buttonRegex.exec(codeToParse)) !== null) {
                const index = parseInt(buttonMatch[1], 10);
                importedSlotData[index] = {
                    itemName: parseJsStringLiteral(buttonMatch[2].trim()),
                    itemDesc: parseJsStringArray(buttonMatch[3].trim()),
                    texture: parseJsStringLiteral(buttonMatch[4].trim()),
                    stackSize: parseInt(buttonMatch[5], 10),
                    durability: parseInt(buttonMatch[6], 10),
                    enchanted: buttonMatch[7] === 'true'
                };
            }

            functionNameInput.value = importedFuncName;
            formSizeSelect.value = importedSize;
            formTitleInput.value = importedTitle;

            initializeGrid(importedSize);

            slotData = importedSlotData;
            patternConfig = importedPatternConfig;

            updateAllSlotVisuals();
            generateCode();
            closeImportModal();
            alert("Code imported successfully!");

        } catch (error) {
            console.error("Error parsing imported code:", error);
            alert("Failed to parse the imported code. Check the console for details. Ensure the code follows the expected ChestFormData structure.");
        }
    }

    formSizeSelect.addEventListener('change', (e) => {
        initializeGrid(e.target.value);
        generateCode();
    });
    toolEditButton.addEventListener('click', () => setTool('edit'));
    toolSelectButton.addEventListener('click', () => setTool('select'));
    saveSlotButton.addEventListener('click', saveSlotData);
    clearSlotButton.addEventListener('click', clearThisSlotData);
    cancelSlotButton.addEventListener('click', closeSlotEditor);
    clearSelectionButton.addEventListener('click', clearMultiSelection);
    editPatternButton.addEventListener('click', openPatternEditor);
    clearIndividualButton.addEventListener('click', clearIndividualSettingsInSelection);
    clearPatternMembershipButton.addEventListener('click', removePatternMembershipFromSelection);
    savePatternButton.addEventListener('click', applyPatternToSelected);
    clearPatternFromSelectedButton.addEventListener('click', clearPatternConfigForSelected);
    cancelPatternButton.addEventListener('click', closePatternEditor);
    generateCodeButton.addEventListener('click', generateCode);
    formTitleInput.addEventListener('input', generateCode);
    functionNameInput.addEventListener('input', generateCode);

    importCodeButton.addEventListener('click', openImportModal);
    confirmImportButton.addEventListener('click', parseAndApplyImportedCode);
    cancelImportButton.addEventListener('click', closeImportModal);

    initializeGrid(formSizeSelect.value);
    setTool('edit');
    generateCode();

});