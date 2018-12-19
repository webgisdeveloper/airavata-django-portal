
import BaseModel from './BaseModel';
import DataType from './DataType';
import ValidatorFactory from './validators/ValidatorFactory';
import uuidv4 from 'uuid/v4';

const FIELDS = [
  'name',
  'value',
  {
    name: 'type',
    type: DataType,
    default: DataType.STRING,
  },
  'applicationArgument',
  {
    name: 'standardInput',
    type: 'boolean',
    default: false,
  },
  'userFriendlyDescription',
  'metaData',
  'inputOrder',
  {
    name: 'isRequired',
    type: 'boolean',
    default: false,
  },
  {
    name: 'requiredToAddedToCommandLine',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dataStaged',
    type: 'boolean',
    default: false,
  },
  'storageResourceId',
  {
    name: 'isReadOnly',
    type: 'boolean',
    default: false,
  },
];

export default class InputDataObjectType extends BaseModel {
  constructor(data = {}) {
    super(FIELDS, data);
    this._key = data.key ? data.key : uuidv4();
  }

  get key() {
    return this._key;
  }

  /**
   * Get the UI component id for the editor component to use for this input.
   * Returns null if there is no editor UI component id.
   *
   * The expected JSON schema for the editor UI component id is the following:
   * {
   *   "editor": {
   *     "ui-component-id": "input-editor-component-id",
   *     ...
   *   }
   * }
   */
  get editorUIComponentId() {
    const metadata = this._getMetadata();
    if (metadata && 'editor' in metadata && 'ui-component-id' in metadata['editor']) {
      return metadata['editor']['ui-component-id'];
    } else {
      return null;
    }
  }

  /**
   * Get the configuration for the editor component, which will be available
   * to the editor component for customizing its look and functionality.
   * Returns empty object if there is no editor config.
   *
   * The expected JSON schema for the editor config is the following:
   * {
   *   "editor": {
   *     "config": {
   *       ... anything can go here ...
   *     }
   *     ...
   *   }
   * }
   */
  get editorConfig() {
    const metadata = this._getMetadata();
    if (metadata && 'editor' in metadata && 'config' in metadata['editor']) {
      return metadata['editor']['config'];
    } else {
      return {};
    }
  }

  /**
   * Get the validations for the editor component. See ValidatorFactory for a
   * list of available validations. Returns empty array if there are no
   * validations.
   *
   * The expected JSON schema for the editor validations is the following:
   * {
   *   "editor": {
   *     "validations": [
   *       {
   *         "type": "validation-name",
   *         "value": "some value for configuring validation, passed to validator constructor",
   *         "message": "(Optional) custom validation error message"
   *       },
   *       ... additional validations go here ...
   *     ]
   *     ...
   *   }
   * }
   *
   * Note: "message" is optional for all validations.
   */
  get editorValidations() {
    const metadata = this._getMetadata();
    if (metadata && 'editor' in metadata && 'validations' in metadata['editor']) {
      return metadata['editor']['validations'];
    } else {
      return [];
    }
  }

  /**
   * TODO
   */
  get editorDependencies() {
    const metadata = this._getMetadata();
    if (metadata && 'editor' in metadata && 'dependencies' in metadata['editor']) {
      return metadata['editor']['dependencies'];
    } else {
      return {};
    }
  }

  _getMetadata() {
    // metaData could really be anything, here we expect it to be an object
    // so safely check if it is first
    if (this.metaData && typeof this.metaData === 'object') {
      return this.metaData;
    } else {
      return null;
    }
  }

  validate(experiment, value = undefined) {
    let inputValue = typeof value != 'undefined' ? value : this.value;
    let results = {};
    let valueErrorMessages = [];
    if (this.isRequired && this.isEmpty(inputValue)) {
      valueErrorMessages.push('This field is required.');
    }
    // Run through any validations if configured
    if (this.editorValidations.length > 0) {
      const validatorFactory = new ValidatorFactory();
      valueErrorMessages = valueErrorMessages.concat(validatorFactory.validate(this.editorValidations, inputValue));
    }
    if (valueErrorMessages.length > 0) {
      results['value'] = valueErrorMessages;
    }
    return results;
  }

  evaluateDependencies(inputValues) {
    if (Object.keys(this.editorDependencies).length > 0) {

    }
  }
}
