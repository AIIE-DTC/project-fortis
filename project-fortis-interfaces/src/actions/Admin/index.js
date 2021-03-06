import { SERVICES as AdminServices } from '../../services/Admin';
import { ResponseHandler } from '../shared';
import { doNothing } from '../../utils/Utils';
import constants from '../constants';
import differenceBy from 'lodash/differenceBy';
import differenceWith from 'lodash/differenceWith';
import some from 'lodash/some';
import isArray from 'lodash/isArray';

function getListAfterRemove(listBeforeRemove, itemsRemoved, keyBy) {
  const customComparator = (a, b) => keyBy.every(prop => a[prop] === b[prop]);

  if (isArray(keyBy)) return differenceWith(listBeforeRemove, itemsRemoved, customComparator);
  else return differenceBy(listBeforeRemove, itemsRemoved, keyBy);
}

function addIdsToUsersForGrid(users) {
  users.forEach(user => user.id = `${user.identifier}-${user.role}`);
}

function prepareBlacklistForGrid(rows) {
  rows.forEach(row => {
    if (row && row.filteredTerms && isArray(row.filteredTerms)) {
      row.filteredTerms = row.filteredTerms.join(',');
    }
  });
}

function stringValueToBoolean(rows) {
  rows.forEach(row => {
    row.isLocation = (row.isLocation === 'true');
  });
}

const _methods = {
  restart_pipeline() {
    const self = this;
    AdminServices.restartPipeline((err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (error) {
        self.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

  load_users() {
    const self = this;
    AdminServices.fetchUsers((err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const users = graphqlResponse.users.users;
        addIdsToUsersForGrid(users);
        self.dispatch(constants.ADMIN.LOAD_USERS, { response: users });
      } else {
        self.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

  add_users(users) {
    AdminServices.addUsers(users, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const usersBeforeSave = this.flux.stores.AdminStore.dataStore.users.filter(user => user.id === `${user.identifier}-${user.role}`);
        const usersAdded = graphqlResponse.addUsers.users;
        addIdsToUsersForGrid(usersAdded);
        const usersAfterSave = usersBeforeSave.concat(usersAdded).filter(user => user.identifier !== "" || user.role !== "");
        this.dispatch(constants.ADMIN.LOAD_USERS, {action: 'saved', response: usersAfterSave});
      } else {
        this.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

  remove_users(users, callback) {
    callback = callback != null ? callback : doNothing;

    AdminServices.removeUsers(users, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const usersBeforeRemove = this.flux.stores.AdminStore.dataStore.users;
        const usersRemoved = graphqlResponse.removeUsers.users
        addIdsToUsersForGrid(usersRemoved);
        const usersAfterRemove = getListAfterRemove(usersBeforeRemove, usersRemoved, 'id').filter(user => user.identifier !== "" || user.role !== "");;
        this.dispatch(constants.ADMIN.LOAD_USERS, {action: 'saved', response: usersAfterRemove});
        callback(null, usersAfterRemove);
      } else {
        this.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
        callback(error, null);
      }
    }));
  },

  load_blacklist() {
    AdminServices.fetchBlacklists((err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const blacklist = graphqlResponse.termBlacklist.filters;
        prepareBlacklistForGrid(blacklist);
        this.dispatch(constants.ADMIN.LOAD_BLACKLIST, { response: blacklist });
      } else {
        this.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

  save_blacklist(termFilters) {
    if (!termFilters && termFilters.length === 0) return;
    stringValueToBoolean(termFilters);
    AdminServices.saveBlacklists(termFilters, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const blacklistAfterSave = this.flux.stores.AdminStore.dataStore.blacklist;
        prepareBlacklistForGrid(blacklistAfterSave);
        this.dispatch(constants.ADMIN.LOAD_BLACKLIST, {action: 'saved', response: blacklistAfterSave});
      } else {
        this.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

  remove_blacklist(termFilters) {
    if (!termFilters && termFilters.length === 0) return;
    stringValueToBoolean(termFilters);
    AdminServices.removeBlacklists(termFilters, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const blacklistBeforeRemove = this.flux.stores.AdminStore.dataStore.blacklist;
        const blacklistRemoved = graphqlResponse.removeBlacklist.filters;
        const blacklistAfterRemove = getListAfterRemove(blacklistBeforeRemove, blacklistRemoved, 'id');
        this.dispatch(constants.ADMIN.LOAD_BLACKLIST, {action: 'saved', response: blacklistAfterRemove});
      } else {
        this.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
      }
    }));
  },

    load_streams() {
      const self = this;
      const dataStore = this.flux.stores.AdminStore.dataStore;

      if (!dataStore.loading) {
        AdminServices.fetchStreams((err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
          if (graphqlResponse) {
            let response = graphqlResponse ? graphqlResponse.streams.streams : [];
            response.forEach(stream => {
              stream.params = JSON.stringify(stream.params)
            });
            const action = false;
            self.dispatch(constants.ADMIN.LOAD_STREAMS, {response, action});
          } else {
            const error = 'Error, could not load streams for admin page';
            self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
          }
        }))
      }
    },

    save_stream(streams) {
      if (!streams || streams.length === 0) return;

      AdminServices.saveStreams(streams, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse) {
          const streamsListed = this.flux.stores.AdminStore.dataStore.streams;
          const savedStreamExistsInStreamsListed = () => some(streamsListed, stream => (stream.pipelineKey === streams[0].pipelineKey) && (stream.streamId === streams[0].streamId));
          
          const updateStreamInStreamsListed = () => streamsListed.forEach(stream => {
            if (stream.pipelineKey === streams[0].pipelineKey && stream.streamId === streams[0].streamId) {
              stream.params = streams[0].params;
            }
          })
          
          const insertStreamInStreamsListed = () => streamsListed.push(streams[0]);

          savedStreamExistsInStreamsListed() ? updateStreamInStreamsListed() : insertStreamInStreamsListed();

          this.dispatch(constants.ADMIN.LOAD_STREAMS, { action: 'saved', response: streamsListed });
        } else {
          this.dispatch(constants.ADMIN.LOAD_FAIL, { error: 'Error, could not load streams for admin page.' });
        }
      }));
    },

    remove_streams(streams) {
      AdminServices.removeStreams(streams, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse) {
          const streamsBeforeRemove = this.flux.stores.AdminStore.dataStore.streams;
          const streamsRemoved = graphqlResponse.removeStreams.streams;
          const streamsAfterRemove = getListAfterRemove(streamsBeforeRemove, streamsRemoved, ['pipelineKey', 'streamId']);
          this.dispatch(constants.ADMIN.LOAD_STREAMS, { action: 'saved', response: streamsAfterRemove });
        } else {
          this.dispatch(constants.ADMIN.LOAD_FAIL, { error: 'Could not load streams for admin page.' });
        }
      }));
    },

    load_settings() {
        const self = this;
        AdminServices.fetchSite((err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
            if (graphqlResponse && !error) {
                self.dispatch(constants.ADMIN.LOAD_SITE_SETTINGS, graphqlResponse.sites.site);
            } else {
                self.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
            }
        }));
    },

    changeLanguage(language) {
        this.dispatch(constants.APP.CHANGE_LANGUAGE, language);
    },

    save_settings(settings) {
      const self = this;

      AdminServices.editSite(settings, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse && !error) {
          const action = 'saved';
          self.dispatch(constants.ADMIN.SAVE_SITE_SETTINGS, {settings: settings, action: action});
        } else {
          self.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
        }
      }));
    },

  load_topics(translationLanguage) {
    const self = this;
    const dataStore = this.flux.stores.AdminStore.dataStore;
    if (!dataStore.loading) {
      AdminServices.fetchTopics(translationLanguage, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse && !error) {
          const response = graphqlResponse.siteTerms.edges ? graphqlResponse.siteTerms.edges : [];
          const action = "saved";
          self.dispatch(constants.ADMIN.LOAD_TOPICS, {response, action});
        } else {
          const error = 'Error, could not load keywords for admin page';
          self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
        }
      }))
    }
  },

  save_topics(topics) {
    const self = this;
    AdminServices.saveTopics(topics, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
      if (graphqlResponse && !error) {
        const action = "saved";
        const topicsAfterSave = this.flux.stores.AdminStore.dataStore.watchlist;
        self.dispatch(constants.ADMIN.LOAD_TOPICS, { action, response: topicsAfterSave});
      } else {
        const error = 'Error, could not load keywords for admin page';
        self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
      }
    }));
  },

  remove_topics(topics) {
    const self = this;
    const dataStore = this.flux.stores.AdminStore.dataStore;
    if (!dataStore.loading) {
      AdminServices.removeTopics(topics, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse && !error) {
          const action = "saved";
          const topicsBeforeRemove = this.flux.stores.AdminStore.dataStore.watchlist;
          const topicsToRemove = graphqlResponse.removeKeywords.edges;
          const topicsAfterRemove = getListAfterRemove(topicsBeforeRemove, topicsToRemove, 'topicid');
          self.dispatch(constants.ADMIN.LOAD_TOPICS, { action, response: topicsAfterRemove });
        } else {
          const error = 'Error, could not remove keywords from admin page';
          self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
        }
      }));
    }
  },

  notifyDataGridTrustedSourcesLoaded() {
    const self = this;
    const action = "saved";
    self.dispatch(constants.ADMIN.LOAD_TRUSTED_SOURCES, {action});
  },

  save_trusted_sources(sources) {
    const self = this;
    const dataStore = this.flux.stores.DataStore.dataStore;
    if (!dataStore.loading) {
      AdminServices.saveTrustedSources(sources, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse && !error) {
          const trustedSourcesAfterSave = this.flux.stores.DataStore.dataStore.trustedSources;
          const action = 'saved';
          self.dispatch(constants.ADMIN.LOAD_TRUSTED_SOURCES, {action});
          self.dispatch(constants.DASHBOARD.LOAD_TRUSTED_SOURCES, {response: trustedSourcesAfterSave});
        } else {
          const error = 'Error, could not load trusted sources for admin page';
          self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
        }
      }))
    }
  },

  remove_trusted_sources(sources) {
    const self = this;
    const dataStore = this.flux.stores.DataStore.dataStore;
    if (!dataStore.loading) {
      AdminServices.removeTrustedSources(sources, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
        if (graphqlResponse && !error) {
          const action = 'saved';
          const trustedSourcesBeforeRemove = this.flux.stores.DataStore.dataStore.trustedSources;
          const trustedSourcesRemoved = graphqlResponse.removeTrustedSources.sources
          const trustedSourcesAfterRemove = getListAfterRemove(trustedSourcesBeforeRemove, trustedSourcesRemoved, 'rowKey');
          self.dispatch(constants.ADMIN.LOAD_TRUSTED_SOURCES, {action});
          self.dispatch(constants.DASHBOARD.LOAD_TRUSTED_SOURCES, {response: trustedSourcesAfterRemove})
        } else {
          const error = 'Error, could not load trusted sources for admin page';
          self.dispatch(constants.ADMIN.LOAD_FAIL, { error });
        }
      }))
    }
  },

    publish_events(events){
        AdminServices.publishCustomEvents(events, (err, response, body) => ResponseHandler(err, response, body, (error, graphqlResponse) => {
            let action = 'saved';
            const self = this;

            if (graphqlResponse && !error) {
                self.dispatch(constants.ADMIN.PUBLISHED_EVENTS, {action});
            }else{
                self.dispatch(constants.ADMIN.LOAD_FAIL, { error: error.message });
            }
        }));
    }
};

const methods = { ADMIN: _methods };

module.exports = {
    constants,
    methods
};
