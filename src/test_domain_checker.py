from domain_checker import check_job_post

sample_text = """
Software Engineer needed urgently.
Send your CV to microsoftjobs@gmail.com.
Apply here : https://microsoft-careers-jobapply.xyz
"""

result = check_job_post(sample_text)

print(result)