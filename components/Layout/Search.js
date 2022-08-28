import React, { useState, useCallback } from 'react'
import { List, Image, Search } from 'semantic-ui-react'
import axios from 'axios'
import cookie from 'js-cookie'
import Router from 'next/router'
import baseUrl from '../../utils/baseUrl'
import debounce from 'lodash.debounce'
let cancel

function SearchComponent() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])

  const debounceDropDown = useCallback(
    debounce((value) => handleSearch(value), 1000),
    []
  )

  const handleSearch = async (value) => {
    try {
      cancel && cancel()
      const CancelToken = axios.CancelToken
      const token = cookie.get('token')

      const res = await axios.get(`${baseUrl}/api/search/${value}`, {
        headers: { Authorization: token },
        cancelToken: new CancelToken((canceler) => {
          cancel = canceler
        }),
      })

      if (res.data.length === 0) return setLoading(false)

      setResults(res.data)
      setLoading(false)
    } catch (error) {
      alert('Error Searching')
      setLoading(false)
    }
  }

  const handleChange = async (e) => {
    const { value } = e.target
    setText(value)

    if (value.length > 0) {
      setLoading(true)
      debounceDropDown(e.target.value)
    }
  }

  return (
    <Search
      onBlur={() => {
        results.length > 0 && setResults([])
        loading && setLoading(false)
        setText('')
      }}
      loading={loading}
      value={text}
      resultRenderer={ResultRenderer}
      results={results}
      onSearchChange={handleChange}
      minCharacters={1}
      onResultSelect={(e, data) => Router.push(`/${data.result.username}`)}
    />
  )
}

const ResultRenderer = ({ _id, profilePicUrl, name }) => {
  return (
    <List key={_id}>
      <List.Item>
        <Image src={profilePicUrl} alt="ProfilePic" avatar circular />
        <List.Content header={name} as="a" />
      </List.Item>
    </List>
  )
}

export default SearchComponent
