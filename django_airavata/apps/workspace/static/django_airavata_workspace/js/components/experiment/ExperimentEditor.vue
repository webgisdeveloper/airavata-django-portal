<template>
  <div>
    <div class="row">
      <div class="col-auto mr-auto">
        <h1 class="h4 mb-4">
          <div
            v-if="appModule"
            class="application-name text-muted text-uppercase"
          ><i
              class="fa fa-code"
              aria-hidden="true"
            ></i> {{ appModule.appModuleName }}</div>
          <slot name="title">Experiment Editor</slot>
        </h1>
      </div>
      <div class="col-auto">
        <share-button
          ref="shareButton"
          :entity-id="localExperiment.experimentId"
          :auto-add-default-gateway-users-group="false"
        />
      </div>
    </div>
    <b-form novalidate>
      <div class="row">
        <div class="col">
          <b-form-group
            label="Experiment Name"
            label-for="experiment-name"
            :feedback="getValidationFeedback('experimentName')"
            :state="getValidationState('experimentName')"
          >
            <b-form-input
              id="experiment-name"
              type="text"
              v-model="localExperiment.experimentName"
              required
              placeholder="Experiment name"
              :state="getValidationState('experimentName')"
            ></b-form-input>
          </b-form-group>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <b-form-group
            label="Project"
            label-for="project"
            :feedback="getValidationFeedback('projectId')"
            :state="getValidationState('projectId')"
          >
            <b-form-select
              id="project"
              v-model="localExperiment.projectId"
              :options="projectOptions"
              required
              :state="getValidationState('projectId')"
            >
              <template slot="first">
                <option
                  :value="null"
                  disabled
                >Select a Project</option>
              </template>
            </b-form-select>
          </b-form-group>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <h1 class="h4 mt-5 mb-4">
            Application Configuration
          </h1>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="card border-default">
            <div class="card-body">
              <h2 class="h6 mb-3">
                Application Inputs
              </h2>
              <transition-group name="fade">
                <input-editor-container
                  v-for="experimentInput in localExperiment.experimentInputs"
                  :experiment-input="experimentInput"
                  v-model="experimentInput.value"
                  v-show="experimentInput.show"
                  :key="experimentInput.name"
                  @invalid="recordInvalidInputEditorValue(experimentInput.name)"
                  @valid="recordValidInputEditorValue(experimentInput.name)"
                  @input="inputValueChanged"
                />
              </transition-group>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <h2 class="h4 mt-4 mb-3">
            Resource Selection
          </h2>
        </div>
      </div>
      <group-resource-profile-selector v-model="localExperiment.userConfigurationData.groupResourceProfileId">
      </group-resource-profile-selector>
      <div class="row">
        <div class="col">
          <computational-resource-scheduling-editor
            v-model="localExperiment.userConfigurationData.computationalResourceScheduling"
            v-if="localExperiment.userConfigurationData.groupResourceProfileId"
            :app-module-id="appModule.appModuleId"
            :group-resource-profile-id="localExperiment.userConfigurationData.groupResourceProfileId"
          >
          </computational-resource-scheduling-editor>
        </div>
      </div>
      <div class="row">
        <div
          id="col-exp-buttons"
          class="col"
        >
          <b-button
            variant="success"
            @click="saveAndLaunchExperiment"
            :disabled="isSaveDisabled"
          >
            Save and Launch
          </b-button>
          <b-button
            variant="primary"
            @click="saveExperiment"
            :disabled="isSaveDisabled"
          >
            Save
          </b-button>
        </div>
      </div>
    </b-form>
  </div>
</template>

<script>
import ComputationalResourceSchedulingEditor from "./ComputationalResourceSchedulingEditor.vue";
import GroupResourceProfileSelector from "./GroupResourceProfileSelector.vue";
import InputEditorContainer from "./input-editors/InputEditorContainer.vue";
import { models, services, utils as apiUtils } from "django-airavata-api";
import { components, utils } from "django-airavata-common-ui";

export default {
  name: "edit-experiment",
  props: {
    experiment: {
      type: models.Experiment,
      required: true
    },
    appModule: {
      type: models.ApplicationModule,
      required: true
    }
  },
  data() {
    return {
      projects: [],
      localExperiment: this.experiment.clone(),
      invalidInputs: []
    };
  },
  components: {
    ComputationalResourceSchedulingEditor,
    GroupResourceProfileSelector,
    InputEditorContainer,
    "share-button": components.ShareButton
  },
  mounted: function() {
    services.ProjectService.listAll().then(
      projects => (this.projects = projects)
    );
  },
  computed: {
    projectOptions: function() {
      return this.projects.map(project => ({
        value: project.projectID,
        text: project.name
      }));
    },
    valid: function() {
      const validation = this.localExperiment.validate();
      return (
        Object.keys(validation).length === 0 && this.invalidInputs.length === 0
      );
    },
    isSaveDisabled: function() {
      return !this.valid;
    }
  },
  methods: {
    saveExperiment: function() {
      return this.uploadInputFiles()
        .then(this.saveOrUpdateExperiment)
        .then(experiment => {
          this.localExperiment = experiment;
          this.$emit("saved", experiment);
        });
    },
    saveAndLaunchExperiment: function() {
      return this.uploadInputFiles()
        .then(this.saveOrUpdateExperiment)
        .then(experiment => {
          this.localExperiment = experiment;
          return services.ExperimentService.launch({
            lookup: experiment.experimentId
          }).then(() => {
            this.$emit("savedAndLaunched", experiment);
          });
        });
    },
    saveOrUpdateExperiment: function() {
      if (this.localExperiment.experimentId) {
        return services.ExperimentService.update({
          lookup: this.localExperiment.experimentId,
          data: this.localExperiment
        });
      } else {
        return services.ExperimentService.create({
          data: this.localExperiment
        }).then(experiment => {
          // Can't save sharing settings for a new experiment until it has been
          // created
          return this.$refs.shareButton
            .mergeAndSave(experiment.experimentId)
            .then(() => experiment);
        });
      }
    },
    uploadInputFiles: function() {
      let uploads = [];
      this.localExperiment.experimentInputs.forEach(input => {
        if (
          input.type === models.DataType.URI &&
          input.value &&
          input.value instanceof File
        ) {
          let data = new FormData();
          data.append("file", input.value);
          data.append("project-id", this.localExperiment.projectId);
          data.append("experiment-name", this.localExperiment.experimentName);
          let uploadRequest = apiUtils.FetchUtils.post(
            "/api/upload",
            data
          ).then(result => (input.value = result["data-product-uri"]));
          uploads.push(uploadRequest);
        }
      });
      return Promise.all(uploads);
    },
    getValidationFeedback: function(properties) {
      return utils.getProperty(this.localExperiment.validate(), properties);
    },
    getValidationState: function(properties) {
      return this.getValidationFeedback(properties) ? "invalid" : null;
    },
    recordInvalidInputEditorValue: function(experimentInputName) {
      if (!this.invalidInputs.includes(experimentInputName)) {
        this.invalidInputs.push(experimentInputName);
      }
    },
    recordValidInputEditorValue: function(experimentInputName) {
      if (this.invalidInputs.includes(experimentInputName)) {
        const index = this.invalidInputs.indexOf(experimentInputName);
        this.invalidInputs.splice(index, 1);
      }
    },
    inputValueChanged: function() {
      this.localExperiment.evaluateInputDependencies();
    }
  },
  watch: {
    experiment: function(newValue) {
      this.localExperiment = newValue.clone();
    }
  }
};
</script>

<style>
.application-name {
  font-size: 12px;
}
#col-exp-buttons {
  text-align: right;
}
</style>
