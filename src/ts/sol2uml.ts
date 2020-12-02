#! /usr/bin/env node

import { EtherscanParser } from './etherscanParser'
import { parseUmlClassesFromFiles } from './fileParser'
import { classesConnectedToBaseContracts } from './contractFilter'
import { UmlClass } from './umlClass'

const debugControl = require('debug')
const debug = require('debug')('sol2uml')

const program = require('commander')

program
    .usage(
        `<fileFolderAddress> [options]

Generates UML diagrams from Solidity source code.

If no file, folder or address is passes as the first argument, the working folder is used.
When a folder is used, all *.sol files are found in that folder and all sub folders.
A comma separated list of files and folders can also used. For example
    sol2uml contracts,node_modules/openzeppelin-solidity

If an Ethereum address with a 0x prefix is passed, the verified source code from Etherscan will be used. For example
    sol2uml 0x79fEbF6B9F76853EDBcBc913e6aAE8232cFB9De9`
    )
    .option(
        '-b, --baseContractNames <value>',
        'only output contracts connected to these comma separated base contract names'
    )
    .option(
        '-f, --outputFormat <value>',
        'output file format: svg, png, dot or all',
        'svg'
    )
    .option('-o, --outputFileName <value>', 'output file name')
    .option(
        '-d, --depthLimit <depth>',
        'number of sub folders that will be recursively searched for Solidity files. Default -1 is unlimited',
        -1
    )
    .option(
        '-i, --ignoreFilesOrFolders <filesOrFolders>',
        'comma separated list of files or folders to ignore'
    )
    .option(
        '-n, --network <network>',
        'mainnet, ropsten, kovan, rinkeby or goerli',
        'mainnet'
    )
    .option('-k, --etherscanApiKey <key>', 'Etherscan API Key')
    .option('-c, --clusterFolders', 'cluster contracts into source folders')
    .option('-v, --verbose', 'run with debugging statements')
    .parse(process.argv)

if (program.verbose) {
    debugControl.enable('sol2uml')
}

// This function needs to be loaded after the DEBUG env variable has been set
import { generateFilesFromUmlClasses } from './converter'

async function sol2uml() {
    let fileFolderAddress: string
    if (program.args.length === 0) {
        fileFolderAddress = process.cwd()
    } else {
        fileFolderAddress = program.args[0]
    }

    let umlClasses: UmlClass[]
    if (fileFolderAddress.match(/^0x([A-Fa-f0-9]{40})$/)) {
        debug(
            `argument ${fileFolderAddress} is an Ethereum address so checking Etherscan for the verified source code`
        )

        const etherscanApiKey =
            program.etherscanApiKey || 'ZAD4UI2RCXCQTP38EXS3UY2MPHFU5H9KB1'
        const etherscanParser = new EtherscanParser(
            etherscanApiKey,
            program.network
        )

        umlClasses = await etherscanParser.getUmlClasses(fileFolderAddress)
    } else {
        const depthLimit = parseInt(program.depthLimit)
        if (isNaN(depthLimit)) {
            console.error(
                `depthLimit option must be an integer. Not ${program.depthLimit}`
            )
            process.exit(1)
        }

        const filesFolders: string[] = fileFolderAddress.split(',')
        let ignoreFilesFolders = program.ignoreFilesOrFolders
            ? program.ignoreFilesOrFolders.split(',')
            : []
        umlClasses = await parseUmlClassesFromFiles(
            filesFolders,
            ignoreFilesFolders,
            depthLimit
        )
    }

    let filteredUmlClasses = umlClasses
    if (program.baseContractNames) {
        const baseContractNames = program.baseContractNames.split(',')
        filteredUmlClasses = classesConnectedToBaseContracts(
            umlClasses,
            baseContractNames
        )
    }

    generateFilesFromUmlClasses(
        filteredUmlClasses,
        fileFolderAddress,
        program.outputFormat,
        program.outputFileName,
        program.clusterFolders
    ).then(() => {
        debug(`Finished`)
    })
}

try {
    sol2uml()
} catch (err) {
    console.error(`Failed to generate UML diagram ${err.message}`)
}
