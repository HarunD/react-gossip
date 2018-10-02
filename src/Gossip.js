// TODO:
// - add flow
import React, {Component} from 'react';
import PropTypes, {func} from 'prop-types';
import GossipJS from 'gossip-js';

import css from './style.css';

export default class Gossip extends Component {
    state = {
        G: new GossipJS(this.props.apiBase, this.props.isSSL), // Gossip instance
        C: null, // Channel instance
        channel: this.props.channel,
        hasError: false,
        isChannelConnected: false,
        messageThread: [],
        newMessage: '',
        nick: this.props.nick,
        secret: this.props.secret
    };

    componentDidMount() {
        this._setupAndConnect({channel: this.props.channel, channelSecret: this.props.channelSecret, userNick: this.props.nick, userSecret: this.props.secret});
    }

    componentDidUpdate(prevProps, prevState) {
        this._scrollToBottom();
    }

    componentWillUnmount() {
        this
            .state
            .C
            .close();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.channel !== this.state.channel) {
            this.setState({channel: nextProps.channel, nick: nextProps.nick, secret: nextProps.secret});
            this._setupAndConnect({channel: nextProps.channel, channelSecret: nextProps.channelSecret, userNick: nextProps.nick, userSecret: nextProps.secret});
        }

        if (nextProps.newMessage) {
            this._sendMessage(nextProps.newMessage);
        }
    }

    _log = (msg, detail) => {
        if (this.props.shouldLog) {
            console.log("Gossip", msg, detail
                ? detail
                : '');
        }
    }

    /*
        Setup the channel
    */

    _setupAndConnect = ({channel, channelSecret, userNick, userSecret}) => {
        const C = this._setupChannel(channel, channelSecret);

        this.setState({C});
        C.connect(userNick, userSecret);
    }

    _setupChannel = (name, secret) => {
        const C = this
            .state
            .G
            .newChannel(name, secret);

        C.onconnect = () => {
            this._log("connected to channel");
            this.setState({hasError: false, isChannelConnected: true});
        }

        C.onmessage = msg => {
            this._log("got message: ", this.state.nick, msg);
            let messageThread = this.state.messageThread;
            messageThread.push(msg);
            this.setState({hasError: false, messageThread});

            if (this.props.onMessageReceived) {
                this
                    .props
                    .onMessageReceived(msg);
            }
        };

        C.onhistory = history => {
            this._log("got history: ", history);
            let messageThread = this.state.messageThread;
            messageThread = history.concat(messageThread);
            this.setState({hasError: false, messageThread});
        };

        C.onerror = err => {
            this._log("has error: ", err);
            this.setState({hasError: true, errorMsg: err});
        }

        C.onclose = () => {
            this._log("closed");
            this.setState({isChannelConnected: false});
        }

        return C;
    }

    /*
        Handler methods
    */

    _handleChange = event => {
        let newMessage = event.target.value;
        this.setState({newMessage});
    }

    _handleKeyPress = event => {
        if (event.key === 'Enter') {
            this._sendMessage({text: this.state.newMessage});
        }
    }

    _handleAttachmentClick = url => {
        window.open(url);
    }

    _sendMessage = newMsg => {
        if (!this.state.isChannelConnected) {
            return;
        }

        this
            .state
            .C
            .send(newMsg.text, newMsg.meta);

        this._appendSentMessageToThread(newMsg);

        if (this.props.onMessageSent) {
            this
                .props
                .onMessageSent(newMsg);
        }
    }

    _appendSentMessageToThread = newMsg => {
        let time = new Date();
        time = time.toISOString();

        let messageThread = this.state.messageThread;
        messageThread.push({from: this.state.nick, text: newMsg.text, meta: newMsg.meta, time});

        this.setState({newMessage: '', messageThread});
    }

    _scrollToBottom = () => {
        let $ = document.getElementById(this.props.threadId);
        if ($) {
            $.scrollTop = $.scrollHeight;
        }
    }

    /*
        Render methods
    */

    _renderThread = () => {
        let {C, messageThread, nick} = this.state;

        if (!C) {
            return (
                <div className="Gossip__Not-Functional">
                    No channel selected
                </div>
            );
        }

        if (!messageThread || messageThread.length === 0) {
            return (
                <div className="Gossip__Not-Functional">
                    No messages in #{this.props.channel}
                </div>
            );
        }

        return (
            <div id={this.props.threadId} className="Gossip__Thread">
                {messageThread.map((m, k, arr) => {
                    let isMine = (m.from === nick)
                        ? true
                        : false;
                    let isSelf = (m.meta && m.meta.is_self === 'yes')
                        ? true
                        : false;
                    let hasImage = (m.meta && m.meta.img_url)
                        ? true
                        : false;

                    if (isSelf && !this.props.shouldSeeSelf) {
                        return null;
                    }

                    let isFromVisible = true;
                    if (this.props.nameDisplayStyle === 'grouped') {
                        isFromVisible = (k === 0 || (k > 0 && m.from !== arr[k - 1].from))
                            ? true
                            : false;
                    }

                    let isNewDay = true;
                    let timestamp = new Date(m.time);
                    let date = timestamp.toLocaleDateString();
                    let M = timestamp.getMinutes();
                    let minutes = (M < 10)
                        ? `0${M}`
                        : M;
                    let time = timestamp.getHours() + ':' + minutes;

                    if (k !== 0) {
                        let previousTimestamp = new Date(arr[k - 1].time);

                        if (timestamp.toDateString() !== previousTimestamp.toDateString()) {
                            isNewDay = true;
                        } else {
                            isNewDay = false;
                        }
                    }

                    return (
                        <div key={k}>
                            {isNewDay && <div className="Gossip__Thread__Message__Date">{date}</div>}
                            <div
                                className={`Gossip__Thread__Message ${isMine
                                ? '--own'
                                : ''} ${isSelf
                                    ? '--self'
                                    : ''}`}>
                                {isFromVisible && <div className="Gossip__Thread__Message__Sender">{m.from}</div>}
                                <div className="Gossip__Thread__Message__Time">{time}</div>
                                <div className="Gossip__Thread__Message__Content">
                                    {m.text}
                                    {hasImage && <div className="Gossip__Thread__Message__Content__Att">
                                        <img
                                            src={m.meta.img_url}
                                            onClick={() => this._handleAttachmentClick(m.meta.img_url)}/></div>}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    }

    _renderError = () => {
        return (
            <div className="Gossip__Error">
                There was an error. {this.state.errorMsg && `(${this.state.errorMsg.text})`}
            </div>
        );
    }

    render() {
        let {hasError, isChannelConnected} = this.state;
        let isSendingDisabled = (isChannelConnected)
            ? false
            : true;
        let inputPlaceholder = (isSendingDisabled)
            ? 'There was en error. Sending messages currently disabled.'
            : 'Enter your message here. Press ENTER to send.';

        return (
            <div className={`Gossip ${this.props.className}`} style={this.props.style}>
                {this._renderThread()}
                {hasError && this._renderError()}
                <div className="Gossip__Composer">
                    <input
                        autoFocus
                        type="text"
                        name="newMessage"
                        disabled={isSendingDisabled}
                        placeholder={inputPlaceholder}
                        value={this.state.newMessage}
                        onChange={this._handleChange}
                        onKeyPress={this._handleKeyPress}/>
                </div>
            </div>
        );
    }
}

Gossip.defaultProps = {
    className: '',
    isSSL: false,
    nameDisplayStyle: 'grouped',
    onMessageReceived: null,
    onMessageSent: null,
    shouldLog: false,
    shouldSeeSelf: false,
    style: null
};

Gossip.propTypes = {
    apiBase: PropTypes.string.isRequired,
    channel: PropTypes.string.isRequired,
    channelSecret: PropTypes.string.isRequired,
    className: PropTypes.string,
    isSSL: PropTypes.bool,
    nameDisplayStyle: PropTypes.string,
    nick: PropTypes.string.isRequired,
    secret: PropTypes.string.isRequired,
    shouldLog: PropTypes.bool,
    shouldSeeSelf: PropTypes.bool,
    style: PropTypes.object,
    threadId: PropTypes.string.isRequired
};