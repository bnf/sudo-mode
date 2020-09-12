<?php
declare(strict_types = 1);
namespace FriendsOfTYPO3\SudoMode\Hook;

/*
 * This file is part of the TYPO3 CMS project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */

use FriendsOfTYPO3\SudoMode\Backend\ExternalServiceAdapter;
use TYPO3\CMS\Backend\Controller\BackendController;
use TYPO3\CMS\Core\Page\PageRenderer;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Hook triggers loading resources (JavaScript, Stylesheets) in backend context.
 */
class BackendResourceHook
{
    public function applyResources(array $parameters, BackendController $backendController)
    {
        // load RSA auth JavaScript modules (if applicable)
        GeneralUtility::makeInstance(ExternalServiceAdapter::class)->applyRsaAuthModules();
    }

    public function applyResourcesToPageRenderer(array $params, PageRenderer $pageRenderer): void
    {
        // Load EventListener if AjaxDataHandler is loaded (or any module that depends
        // on the AjaxDataHandler)
        foreach ($params['jsInline'] as $module => $modules) {
            switch ($module) {
            case 'RequireJS-Module-TYPO3/CMS/Backend/AjaxDataHandler':
            case 'RequireJS-Module-TYPO3/CMS/Backend/ContextMenuActions':
            case 'RequireJS-Module-TYPO3/CMS/Backend/LayoutModule/DragDrop':
            case 'RequireJS-Module-TYPO3/CMS/Backend/LayoutModule/Paste':
            case 'RequireJS-Module-TYPO3/CMS/Backend/PageActions':
                $pageRenderer->loadRequireJsModule('TYPO3/CMS/SudoMode/BackendEventListener');
                // load RSA auth JavaScript modules (if applicable)
                // Note: This is needed when the module is executed without an
                // outer frame that hosts the RSaModule added by applyResources()
                GeneralUtility::makeInstance(ExternalServiceAdapter::class)->applyRsaAuthModules();
                return;
            }
        }
    }
}
